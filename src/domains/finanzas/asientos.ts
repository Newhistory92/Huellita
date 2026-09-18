import { esquemaGasto, type EntradaGasto } from "./esquemas";
import { exigirCaso, exigirPermisoSobreFinanzas } from "./casos";
import type { Asiento, ContextoFinanzas, EstadoCaso, TipoAsiento } from "./tipos";

export interface EntradaAsiento {
  casoId: string;
  tipo: TipoAsiento;
  /** Positivo entra, negativo sale. */
  centavos: bigint;
  descripcion: string;
  fechaEfectiva: Date;
  proveedor?: string | null;
  pagoExternoId?: string | null;
  ajustaAId?: string | null;
  contraparteId?: string | null;
  documentoId?: string | null;
  intencionId?: string | null;
  creadoPorSistema?: boolean;
}

/**
 * El caso alcanza la meta pero no se cierra solo: en una urgencia médica el
 * presupuesto real suele superar al estimado, y cortar el botón de donar
 * frustra a quien quiere ayudar igual. Cerrar es una decisión de una persona.
 */
function estadoSegunSaldo(estadoActual: EstadoCaso, recibidoCentavos: bigint, metaCentavos: bigint): EstadoCaso {
  if (estadoActual === "CERRADO") return "CERRADO";
  return recibidoCentavos >= metaCentavos ? "META_ALCANZADA" : "ABIERTO";
}

/**
 * La única puerta por la que se mueve plata. Escribe el asiento y recalcula los
 * saldos del caso en la misma transacción.
 *
 * Los saldos se recalculan desde la suma de los asientos, no se acumulan sobre
 * el valor anterior. Es más trabajo, y es a propósito: un acumulador que se
 * desincroniza una vez queda mal para siempre, mientras que una suma vuelve a
 * dar el número correcto sola.
 */
export async function registrarAsiento(entrada: EntradaAsiento, ctx: ContextoFinanzas): Promise<Asiento> {
  exigirPermisoSobreFinanzas(ctx);
  const caso = await exigirCaso(entrada.casoId, ctx);

  if (caso.estado === "CERRADO" && entrada.tipo !== "AJUSTE") {
    throw new Error("El caso está cerrado: no acepta movimientos nuevos. Si hay que corregir algo, registrá un ajuste.");
  }
  if (entrada.centavos === 0n) {
    throw new Error("Un movimiento de cero no dice nada: no se registra");
  }

  const asiento = await ctx.repositorio.crearAsiento({
    casoId: caso.id,
    tipo: entrada.tipo,
    centavos: entrada.centavos,
    moneda: caso.moneda,
    descripcion: entrada.descripcion,
    proveedor: entrada.proveedor ?? null,
    pagoExternoId: entrada.pagoExternoId ?? null,
    ajustaAId: entrada.ajustaAId ?? null,
    contraparteId: entrada.contraparteId ?? null,
    documentoId: entrada.documentoId ?? null,
    intencionId: entrada.intencionId ?? null,
    creadoPorId: null,
    creadoPorSistema: entrada.creadoPorSistema ?? false,
    fechaEfectiva: entrada.fechaEfectiva,
  });

  const saldo = await ctx.repositorio.saldoDeCaso(caso.id);
  const estadoNuevo = estadoSegunSaldo(caso.estado, saldo.recibidoCentavos, caso.metaCentavos);
  await ctx.repositorio.actualizarCaso(caso.id, {
    recibidoCentavos: saldo.recibidoCentavos,
    gastadoCentavos: saldo.gastadoCentavos,
    cantidadDonantes: saldo.cantidadDonaciones,
    estado: estadoNuevo,
  });

  // Solo en la transición: si ya estaba en meta alcanzada, no se vuelve a
  // avisar con cada donación posterior.
  if (estadoNuevo === "META_ALCANZADA" && caso.estado !== "META_ALCANZADA") {
    await ctx.avisos.anotar({
      tipo: "META_ALCANZADA",
      datos: { casoId: caso.id, tituloCaso: caso.titulo },
      originadoPorEmail: entrada.creadoPorSistema ? null : ctx.usuarioEmail,
    });
  }

  await ctx.auditoria.registrar({
    usuarioEmail: entrada.creadoPorSistema ? "sistema" : ctx.usuarioEmail,
    accion: "asiento.crear",
    entidad: "AsientoContable",
    entidadId: asiento.id,
    valorNuevo: {
      casoId: caso.id,
      tipo: asiento.tipo,
      centavos: asiento.centavos.toString(),
      descripcion: asiento.descripcion,
    },
  });

  return asiento;
}

/** Un gasto se carga en positivo y se guarda en negativo: quien lo escribe piensa en cuánto salió. */
export async function registrarGasto(entrada: EntradaGasto, ctx: ContextoFinanzas): Promise<Asiento> {
  const datos = esquemaGasto.parse(entrada);
  return registrarAsiento(
    {
      casoId: datos.casoId,
      tipo: "GASTO",
      centavos: -datos.centavos,
      descripcion: datos.descripcion,
      documentoId: datos.documentoId,
      fechaEfectiva: datos.fechaEfectiva,
    },
    ctx
  );
}
