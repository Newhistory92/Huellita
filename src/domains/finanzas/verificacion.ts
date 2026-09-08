import type { RepositorioFinanzas } from "./tipos";

export interface Diferencia {
  casoId: string;
  slug: string;
  guardadoRecibido: bigint;
  calculadoRecibido: bigint;
  guardadoGastado: bigint;
  calculadoGastado: bigint;
}

/**
 * Compara el saldo guardado en cada caso contra la suma real de sus asientos.
 *
 * Si difieren, alguien tocó la base por fuera del sistema, y eso hay que
 * saberlo el mismo día y no cuando lo note un donante.
 */
export async function verificarSaldos(repositorio: RepositorioFinanzas): Promise<Diferencia[]> {
  const casos = await repositorio.listarCasos({});
  const diferencias: Diferencia[] = [];

  for (const caso of casos) {
    const saldo = await repositorio.saldoDeCaso(caso.id);
    if (saldo.recibidoCentavos !== caso.recibidoCentavos || saldo.gastadoCentavos !== caso.gastadoCentavos) {
      diferencias.push({
        casoId: caso.id,
        slug: caso.slug,
        guardadoRecibido: caso.recibidoCentavos,
        calculadoRecibido: saldo.recibidoCentavos,
        guardadoGastado: caso.gastadoCentavos,
        calculadoGastado: saldo.gastadoCentavos,
      });
    }
  }

  return diferencias;
}
