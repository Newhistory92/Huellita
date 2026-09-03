import type { Prisma, PrismaClient } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import { repositorioPrisma } from "@/infra/repositorios/animales";
import { repositorioFotosPrisma } from "@/infra/repositorios/fotos";
import type { Animal, EstadoAnimal, FiltroAnimales, Foto } from "./tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

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

/**
 * Un enlace de Facebook con una dirección vieja nunca puede terminar en 404: si hubo una
 * corrección, esta función encuentra a dónde apunta ahora. Recibe el cliente como parámetro
 * (en vez de ir directo al de `unstable_cache`) para que las pruebas de integración puedan
 * usar la base de datos de pruebas.
 */
export async function buscarSlugActual(slugAnterior: string, cliente: ClienteBase = clientePorDefecto): Promise<string | null> {
  const redireccion = await cliente.redireccionDireccion.findUnique({ where: { slugAnterior } });
  if (!redireccion?.animalId) return null;
  const animal = await repositorioPrisma(cliente).porId(redireccion.animalId);
  return animal?.slug ?? null;
}

export const slugActualDe = unstable_cache(
  async (slugAnterior: string): Promise<string | null> => buscarSlugActual(slugAnterior),
  ["slug-actual"],
  { tags: ["animales"] }
);
