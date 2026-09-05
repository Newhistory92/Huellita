import { esquemaAjuste, type EntradaAjuste } from "./esquemas";
import { registrarAsiento } from "./asientos";
import { exigirCaso, exigirPermisoSobreFinanzas } from "./casos";
import type { Asiento, ContextoFinanzas } from "./tipos";

/**
 * Una corrección nunca reescribe el pasado: crea un asiento nuevo que apunta al
 * que corrige. El original sigue visible en el libro público, y al lado se ve
 * la corrección con su motivo. Eso es lo que hace auditable el historial.
 */
export async function registrarAjuste(entrada: EntradaAjuste, ctx: ContextoFinanzas): Promise<Asiento> {
  exigirPermisoSobreFinanzas(ctx);
  const datos = esquemaAjuste.parse(entrada);

  return registrarAsiento(
    {
      casoId: datos.casoId,
      tipo: "AJUSTE",
      centavos: datos.centavos,
      descripcion: `Ajuste: ${datos.motivo}`,
      ajustaAId: datos.ajustaAId,
      documentoId: datos.documentoId,
      fechaEfectiva: new Date(),
    },
    ctx
  );
}

export interface EntradaTraslado {
  origenId: string;
  destinoId: string;
  centavos: bigint;
  motivo: string;
}

/**
 * Un traslado son dos asientos vinculados, escritos juntos. Aparece en el libro
 * público de los dos casos: no hay forma de mover plata sin dejar las dos
 * puntas registradas.
 */
export async function trasladarEntreCasos(
  entrada: EntradaTraslado,
  ctx: ContextoFinanzas
): Promise<{ salida: Asiento; entrada: Asiento }> {
  exigirPermisoSobreFinanzas(ctx);

  if (entrada.origenId === entrada.destinoId) {
    throw new Error("No se puede trasladar un caso al mismo caso");
  }
  if (entrada.centavos <= 0n) {
    throw new Error("El importe del traslado tiene que ser mayor que cero");
  }
  if (entrada.motivo.trim().length < 10) {
    throw new Error("Escribí el motivo del traslado: queda publicado en los dos casos");
  }

  const origen = await exigirCaso(entrada.origenId, ctx);
  await exigirCaso(entrada.destinoId, ctx);

  const disponible = origen.recibidoCentavos - origen.gastadoCentavos;
  if (entrada.centavos > disponible) {
    throw new Error(`El caso de origen no tiene ese saldo disponible: quedan ${disponible} centavos`);
  }

  // El orden importa y no es arbitrario. Los asientos son inmutables: el
  // disparador de la base rechaza cualquier UPDATE, así que el segundo asiento
  // no puede volver atrás a completarle el vínculo al primero. Por eso se crea
  // primero la llegada, y después la salida apuntando a ella.
  //
  // Con un solo lado alcanza: el esquema declara la relación inversa, así que
  // desde la llegada se llega a la salida sin guardar nada más.
  const llegada = await registrarAsiento(
    {
      casoId: entrada.destinoId,
      tipo: "TRANSFERENCIA",
      centavos: entrada.centavos,
      descripcion: `Traslado desde otro caso: ${entrada.motivo}`,
      fechaEfectiva: new Date(),
    },
    ctx
  );

  const salida = await registrarAsiento(
    {
      casoId: entrada.origenId,
      tipo: "TRANSFERENCIA",
      centavos: -entrada.centavos,
      descripcion: `Traslado a otro caso: ${entrada.motivo}`,
      contraparteId: llegada.id,
      fechaEfectiva: new Date(),
    },
    ctx
  );

  return { salida, entrada: llegada };
}
