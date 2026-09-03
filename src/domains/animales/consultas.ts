import { unstable_cache } from "next/cache";
import { repositorioPrisma } from "@/infra/repositorios/animales";
import { repositorioFotosPrisma } from "@/infra/repositorios/fotos";
import type { Animal, EstadoAnimal, FiltroAnimales, Foto } from "./tipos";

const TAMANOS = { pequeno: "PEQUENO", mediano: "MEDIANO", grande: "GRANDE" } as const;
const ESPECIES = { perro: "PERRO", gato: "GATO", otro: "OTRO" } as const;
const ESTADOS_PUBLICOS = { disponible: "DISPONIBLE", adoptado: "ADOPTADO" } as const satisfies Record<string, EstadoAnimal>;

/** Un filtro inválido en la URL no rompe la página: el enlace puede venir de cualquier lado. */
export function filtroDesdeParametros(params: Record<string, string | undefined>): FiltroAnimales {
  const filtro: FiltroAnimales = { soloPublicados: true };
  const tamano = TAMANOS[params.tamano as keyof typeof TAMANOS];
  const especie = ESPECIES[params.especie as keyof typeof ESPECIES];
  const estado = ESTADOS_PUBLICOS[params.estado as keyof typeof ESTADOS_PUBLICOS];
  if (tamano) filtro.tamano = tamano;
  if (especie) filtro.especie = especie;
  if (estado) filtro.estado = estado;
  return filtro;
}

export const animalesPublicados = unstable_cache(
  async (filtro: FiltroAnimales): Promise<Animal[]> => repositorioPrisma().listar(filtro),
  ["animales-publicados"],
  { tags: ["animales"] }
);

export const animalPorSlug = unstable_cache(
  async (slug: string): Promise<Animal | null> => repositorioPrisma().porSlug(slug),
  ["animal-por-slug"],
  { tags: ["animales"] }
);

export const fotosDeAnimal = unstable_cache(
  async (animalId: string): Promise<Foto[]> => repositorioFotosPrisma().listarPorAnimal(animalId),
  ["fotos-de-animal"],
  { tags: ["animales"] }
);
