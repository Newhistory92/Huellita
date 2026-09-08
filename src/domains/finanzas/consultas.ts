import { unstable_cache } from "next/cache";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { totalPendienteDeVerificar } from "./donaciones";
import type { Asiento, Caso, Documento, FiltroCasos } from "./tipos";

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

/**
 * `unstable_cache` guarda el resultado con `JSON.stringify` a secas: no sabe
 * serializar `BigInt` (revienta) ni reconstruir `Date` al leer de vuelta
 * (queda como string). Estas dos funciones hacen ese trabajo a mano antes de
 * que el valor entre o salga del caché, para que quien llama a una consulta
 * siga recibiendo los mismos tipos que declara `tipos.ts`.
 */
export function paraCache(valor: unknown): unknown {
  if (typeof valor === "bigint") return { $bigint: valor.toString() };
  if (valor instanceof Date) return { $fecha: valor.toISOString() };
  if (Array.isArray(valor)) return valor.map(paraCache);
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([clave, v]) => [clave, paraCache(v)]));
  }
  return valor;
}

export function desdeCache(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(desdeCache);
  if (valor !== null && typeof valor === "object") {
    if ("$bigint" in valor) return BigInt((valor as { $bigint: string }).$bigint);
    if ("$fecha" in valor) return new Date((valor as { $fecha: string }).$fecha);
    return Object.fromEntries(Object.entries(valor).map(([clave, v]) => [clave, desdeCache(v)]));
  }
  return valor;
}

const casosPublicosCacheado = unstable_cache(
  async (filtro: FiltroCasos) => paraCache(await repositorioFinanzasPrisma().listarCasos(filtro)),
  ["casos-publicos"],
  { tags: ["casos"] }
);
export async function casosPublicos(filtro: FiltroCasos): Promise<Caso[]> {
  return desdeCache(await casosPublicosCacheado(filtro)) as Caso[];
}

const casoPorSlugCacheado = unstable_cache(
  async (slug: string) => paraCache(await repositorioFinanzasPrisma().casoPorSlug(slug)),
  ["caso-por-slug"],
  { tags: ["casos"] }
);
export async function casoPorSlug(slug: string): Promise<Caso | null> {
  return desdeCache(await casoPorSlugCacheado(slug)) as Caso | null;
}

const libroDeCasoCacheado = unstable_cache(
  async (casoId: string) => paraCache(await repositorioFinanzasPrisma().asientosDeCaso(casoId)),
  ["libro-de-caso"],
  { tags: ["casos"] }
);
export async function libroDeCaso(casoId: string): Promise<Asiento[]> {
  return desdeCache(await libroDeCasoCacheado(casoId)) as Asiento[];
}

/**
 * Lo pendiente de verificar se muestra aparte y nunca sumado. Vive acá, entre
 * las lecturas del dominio, para que ninguna página tenga que hablar con el
 * repositorio: esa es la regla que verifica la prueba de invariantes.
 */
const pendienteDeCasoCacheado = unstable_cache(
  async (casoId: string) => paraCache(await totalPendienteDeVerificar(casoId, repositorioFinanzasPrisma())),
  ["pendiente-de-caso"],
  { tags: ["casos"] }
);
export async function pendienteDeCaso(casoId: string): Promise<bigint> {
  return desdeCache(await pendienteDeCasoCacheado(casoId)) as bigint;
}

export interface TotalesGenerales {
  recibidoCentavos: bigint;
  gastadoCentavos: bigint;
  saldoCentavos: bigint;
  casosAbiertos: number;
  casosCerrados: number;
}

const totalesGeneralesCacheado = unstable_cache(
  async () => {
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
    return paraCache({
      recibidoCentavos,
      gastadoCentavos,
      saldoCentavos: recibidoCentavos - gastadoCentavos,
      casosAbiertos,
      casosCerrados,
    });
  },
  ["totales-generales"],
  { tags: ["casos"] }
);
export async function totalesGenerales(): Promise<TotalesGenerales> {
  return desdeCache(await totalesGeneralesCacheado()) as TotalesGenerales;
}

/** Solo devuelve el documento si está marcado público: la ruta que lo sirve no distingue quién pide. */
export async function documentoPublico(id: string): Promise<Documento | null> {
  const documento = await repositorioFinanzasPrisma().documentoPorId(id);
  return documento && documento.publico ? documento : null;
}
