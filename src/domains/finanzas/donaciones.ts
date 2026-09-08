import { registrarAsiento } from "./asientos";
import { exigirLecturaDeFinanzas, exigirPermisoSobreFinanzas } from "./casos";
import type { ContextoFinanzas, Intencion, RepositorioFinanzas } from "./tipos";

export interface EntradaTransferencia {
  casoId: string;
  centavos: bigint;
  nombreDonante: string | null;
  publicarNombre: boolean;
  mensaje?: string | null;
  comprobanteId: string | null;
}

/**
 * La declara quien donó, desde el sitio público, así que no exige sesión ni
 * permisos: solo registra que alguien dice haber transferido. Queda pendiente
 * hasta que una persona la compare contra el extracto bancario.
 */
export async function declararTransferencia(
  entrada: EntradaTransferencia,
  repositorio: RepositorioFinanzas
): Promise<Intencion> {
  if (entrada.centavos <= 0n) throw new Error("El importe tiene que ser mayor que cero");
  const caso = await repositorio.casoPorId(entrada.casoId);
  if (!caso) throw new Error("No existe el caso");

  return repositorio.crearIntencion({
    casoId: entrada.casoId,
    centavos: entrada.centavos,
    moneda: caso.moneda,
    nombreDonante: entrada.nombreDonante,
    publicarNombre: entrada.publicarNombre,
    mensaje: entrada.mensaje ?? null,
    proveedor: "transferencia",
    estado: "PENDIENTE_VERIFICACION",
    referenciaExterna: null,
    pagoExternoId: null,
    comprobanteId: entrada.comprobanteId,
  });
}

/** Lo pendiente se muestra aparte y nunca entra en el total público. */
export async function totalPendienteDeVerificar(casoId: string, repositorio: RepositorioFinanzas): Promise<bigint> {
  const pendientes = await repositorio.intencionesPendientes();
  return pendientes.filter((i) => i.casoId === casoId).reduce((total, i) => total + i.centavos, 0n);
}

/** La bandeja del panel: todo lo que todavía no se comparó contra el extracto bancario. */
export async function transferenciasPendientes(ctx: ContextoFinanzas): Promise<Intencion[]> {
  exigirLecturaDeFinanzas(ctx);
  return ctx.repositorio.intencionesPendientes();
}

async function exigirPendiente(intencionId: string, ctx: ContextoFinanzas): Promise<Intencion> {
  const intencion = await ctx.repositorio.intencionPorId(intencionId);
  if (!intencion) throw new Error("No existe la transferencia declarada");
  if (intencion.estado !== "PENDIENTE_VERIFICACION") {
    throw new Error(`La transferencia no está pendiente: su estado es ${intencion.estado}`);
  }
  return intencion;
}

export async function verificarTransferencia(intencionId: string, ctx: ContextoFinanzas): Promise<Intencion> {
  exigirPermisoSobreFinanzas(ctx);
  const intencion = await exigirPendiente(intencionId, ctx);

  const asiento = await registrarAsiento(
    {
      casoId: intencion.casoId,
      tipo: "DONACION",
      centavos: intencion.centavos,
      descripcion: "Transferencia verificada contra el extracto bancario",
      proveedor: "transferencia",
      intencionId: intencion.id,
      documentoId: intencion.comprobanteId,
      fechaEfectiva: new Date(),
    },
    ctx
  );

  const aprobada = await ctx.repositorio.actualizarIntencion(intencion.id, {
    estado: "APROBADA",
    resueltoEn: new Date(),
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "transferencia.verificar",
    entidad: "IntencionDonacion",
    entidadId: intencion.id,
    valorAnterior: { estado: "PENDIENTE_VERIFICACION" },
    valorNuevo: { estado: "APROBADA", asientoId: asiento.id },
  });

  return aprobada;
}

export async function rechazarTransferencia(intencionId: string, motivo: string, ctx: ContextoFinanzas): Promise<Intencion> {
  exigirPermisoSobreFinanzas(ctx);
  if (motivo.trim().length === 0) throw new Error("Escribí el motivo del rechazo: también queda auditado");
  const intencion = await exigirPendiente(intencionId, ctx);

  const rechazada = await ctx.repositorio.actualizarIntencion(intencion.id, {
    estado: "RECHAZADA",
    resueltoEn: new Date(),
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "transferencia.rechazar",
    entidad: "IntencionDonacion",
    entidadId: intencion.id,
    valorAnterior: { estado: "PENDIENTE_VERIFICACION" },
    valorNuevo: { estado: "RECHAZADA", motivo },
  });

  return rechazada;
}
