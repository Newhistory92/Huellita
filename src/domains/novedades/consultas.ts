import { unstable_cache } from "next/cache";
import { paraCache, desdeCache } from "@/domains/finanzas/consultas";
import { repositorioNovedadesPrisma } from "@/infra/repositorios/novedades";
import type { Novedad } from "./tipos";

/**
 * paraCache y desdeCache son obligatorios: unstable_cache guarda con
 * JSON.stringify a secas y devolvería `creadoEn` como texto en un acierto de
 * caché, y la pantalla la formatea como fecha.
 */
export const novedadesDelCaso = unstable_cache(
  async (casoId: string) => paraCache(await repositorioNovedadesPrisma().delCaso(casoId)),
  ["novedades-del-caso"],
  { tags: ["novedades"] }
) as unknown as (casoId: string) => Promise<Novedad[]>;

export const novedadesDelAnimal = unstable_cache(
  async (animalId: string) => paraCache(await repositorioNovedadesPrisma().delAnimal(animalId)),
  ["novedades-del-animal"],
  { tags: ["novedades"] }
) as unknown as (animalId: string) => Promise<Novedad[]>;
