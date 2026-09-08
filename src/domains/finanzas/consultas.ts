import { unstable_cache } from "next/cache";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { totalPendienteDeVerificar } from "./donaciones";
import type { Asiento, Caso, FiltroCasos } from "./tipos";

type ConMetaYRecibido = Pick<Caso, "recibidoCentavos" | "metaCentavos">;

/** Se acota a 100 para que la barra no se desborde cuando hay excedente. */
export function porcentajeDeAvance(caso: ConMetaYRecibido): number {
  if (caso.metaCentavos <= 0n) return 100;
  const crudo = (Number(caso.recibidoCentavos) / Number(caso.metaCentavos)) * 100;
  return Math.min(100, Math.round(crudo * 10) / 10);
}

/** Nunca negativo: "faltan -$120.000" no significa nada para quien lee. */
export function faltaParaLaMeta(caso: ConMetaYRecibido): bigint {
  const falta = caso.metaCentavos - caso.recibidoCentavos;
  return falta > 0n ? falta : 0n;
}

export function excedente(caso: ConMetaYRecibido): bigint {
  const sobra = caso.recibidoCentavos - caso.metaCentavos;
  return sobra > 0n ? sobra : 0n;
}

export const casosPublicos = unstable_cache(
  async (filtro: FiltroCasos): Promise<Caso[]> => repositorioFinanzasPrisma().listarCasos(filtro),
  ["casos-publicos"],
  { tags: ["casos"] }
);

export const casoPorSlug = unstable_cache(
  async (slug: string): Promise<Caso | null> => repositorioFinanzasPrisma().casoPorSlug(slug),
  ["caso-por-slug"],
  { tags: ["casos"] }
);

export const libroDeCaso = unstable_cache(
  async (casoId: string): Promise<Asiento[]> => repositorioFinanzasPrisma().asientosDeCaso(casoId),
  ["libro-de-caso"],
  { tags: ["casos"] }
);

/**
 * Lo pendiente de verificar se muestra aparte y nunca sumado. Vive acá, entre
 * las lecturas del dominio, para que ninguna página tenga que hablar con el
 * repositorio: esa es la regla que verifica la prueba de invariantes.
 */
export const pendienteDeCaso = unstable_cache(
  async (casoId: string): Promise<bigint> => totalPendienteDeVerificar(casoId, repositorioFinanzasPrisma()),
  ["pendiente-de-caso"],
  { tags: ["casos"] }
);

export interface TotalesGenerales {
  recibidoCentavos: bigint;
  gastadoCentavos: bigint;
  saldoCentavos: bigint;
  casosAbiertos: number;
  casosCerrados: number;
}

export const totalesGenerales = unstable_cache(
  async (): Promise<TotalesGenerales> => {
    const casos = await repositorioFinanzasPrisma().listarCasos({});
    let recibidoCentavos = 0n;
    let gastadoCentavos = 0n;
    let casosAbiertos = 0;
    let casosCerrados = 0;
    for (const caso of casos) {
      recibidoCentavos += caso.recibidoCentavos;
      gastadoCentavos += caso.gastadoCentavos;
      if (caso.estado === "CERRADO") casosCerrados++;
      else casosAbiertos++;
    }
    return { recibidoCentavos, gastadoCentavos, saldoCentavos: recibidoCentavos - gastadoCentavos, casosAbiertos, casosCerrados };
  },
  ["totales-generales"],
  { tags: ["casos"] }
);
