import { registrarAsiento } from "@/domains/finanzas/asientos";
import { formatearCentavos } from "@/domains/finanzas/dinero";
import type { PuertoAuditoria } from "@/domains/animales/tipos";
import type { PuertoAvisos } from "@/domains/avisos/tipos";
import type { RepositorioFinanzas } from "@/domains/finanzas/tipos";
import type { ProveedorDePagos } from "./tipos";

export interface Aviso {
  pagoExternoId: string;
}

export interface ContextoAviso {
  repositorio: RepositorioFinanzas;
  auditoria: PuertoAuditoria;
  proveedor: ProveedorDePagos;
  avisos: PuertoAvisos;
}

export type ResultadoAviso =
  | { tipo: "asentado"; asientoId: string }
  | { tipo: "ya-procesado" }
  | { tipo: "no-aprobado"; estado: string }
  | { tipo: "sin-intencion" }
  | { tipo: "reintentar"; razon: string };

/**
 * Convierte un aviso del proveedor en un asiento, si corresponde.
 *
 * El aviso solo aporta el número de pago. El estado y el importe se consultan
 * contra la API del proveedor con nuestro propio token: un aviso falsificado
 * no puede inventar plata.
 */
export async function procesarAviso(aviso: Aviso, ctx: ContextoAviso): Promise<ResultadoAviso> {
  // Primera barrera contra el doble conteo: si ya hay asiento para este pago,
  // no se vuelve a asentar. Hace falta además de la deduplicación de avisos
  // porque el proveedor manda avisos distintos sobre el mismo pago cuando
  // cambia de estado, y esos son legítimos.
  const yaAsentado = await ctx.repositorio.asientoPorPagoExterno(ctx.proveedor.nombre, aviso.pagoExternoId);
  if (yaAsentado) return { tipo: "ya-procesado" };

  const pago = await ctx.proveedor.consultarPago(aviso.pagoExternoId);

  if (pago.estado === "inexistente") {
    // Si la firma era válida, el aviso vino del proveedor y ese pago existe:
    // que la API todavía no lo devuelva es una carrera con su propagación
    // interna, no un pago inventado. Conviene reintentar.
    return { tipo: "reintentar", razon: "el proveedor todavía no devuelve ese pago" };
  }

  if (!pago.referenciaExterna) return { tipo: "sin-intencion" };
  const intencion = await ctx.repositorio.intencionPorId(pago.referenciaExterna);
  if (!intencion) return { tipo: "sin-intencion" };

  if (pago.estado !== "aprobado") {
    if (pago.estado === "rechazado") {
      await ctx.repositorio.actualizarIntencion(intencion.id, {
        estado: "RECHAZADA",
        resueltoEn: new Date(),
        pagoExternoId: aviso.pagoExternoId,
      });
    }
    return { tipo: "no-aprobado", estado: pago.estado };
  }

  const asiento = await registrarAsiento(
    {
      casoId: intencion.casoId,
      tipo: "DONACION",
      // El importe es el que informa el proveedor, no el de la intención: lo
      // que vale es lo que efectivamente se pagó.
      centavos: pago.centavos,
      descripcion: "Donación verificada contra el proveedor de pagos",
      proveedor: ctx.proveedor.nombre,
      pagoExternoId: aviso.pagoExternoId,
      intencionId: intencion.id,
      creadoPorSistema: true,
      fechaEfectiva: new Date(),
    },
    {
      usuarioEmail: "sistema",
      rol: "ADMINISTRACION",
      repositorio: ctx.repositorio,
      auditoria: ctx.auditoria,
      avisos: ctx.avisos,
    }
  );

  await ctx.repositorio.actualizarIntencion(intencion.id, {
    estado: "APROBADA",
    pagoExternoId: aviso.pagoExternoId,
    resueltoEn: new Date(),
  });

  const caso = await ctx.repositorio.casoPorId(intencion.casoId);
  await ctx.avisos.anotar({
    tipo: "DONACION_VERIFICADA",
    datos: { casoId: intencion.casoId, tituloCaso: caso?.titulo ?? "", montoTexto: formatearCentavos(pago.centavos) },
    originadoPorEmail: null,
  });

  return { tipo: "asentado", asientoId: asiento.id };
}
