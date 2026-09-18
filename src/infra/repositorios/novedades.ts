import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import type { Novedad, RepositorioNovedades } from "@/domains/novedades/tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

/** La base guarda la foto desarmada en columnas; el dominio la ve como un objeto. */
type FilaNovedad = {
  id: string;
  casoId: string | null;
  animalId: string | null;
  titulo: string;
  cuerpo: string;
  fotoClave: string | null;
  fotoAlt: string | null;
  fotoAncho: number | null;
  fotoAlto: number | null;
  fotoPlaceholder: string | null;
  documentoId: string | null;
  autorEmail: string;
  archivada: boolean;
  creadoEn: Date;
};

function aDominio(fila: FilaNovedad): Novedad {
  return {
    id: fila.id,
    casoId: fila.casoId,
    animalId: fila.animalId,
    titulo: fila.titulo,
    cuerpo: fila.cuerpo,
    // O están todos los campos de la foto, o no hay foto. Nunca a medias.
    foto:
      fila.fotoClave && fila.fotoAlt
        ? {
            clave: fila.fotoClave,
            alt: fila.fotoAlt,
            ancho: fila.fotoAncho ?? 0,
            alto: fila.fotoAlto ?? 0,
            placeholder: fila.fotoPlaceholder ?? "",
          }
        : null,
    documentoId: fila.documentoId,
    autorEmail: fila.autorEmail,
    archivada: fila.archivada,
    creadoEn: fila.creadoEn,
  };
}

function aFila(datos: Partial<Novedad>) {
  const { foto, ...resto } = datos;
  if (foto === undefined) return resto;
  return {
    ...resto,
    fotoClave: foto?.clave ?? null,
    fotoAlt: foto?.alt ?? null,
    fotoAncho: foto?.ancho ?? null,
    fotoAlto: foto?.alto ?? null,
    fotoPlaceholder: foto?.placeholder ?? null,
  };
}

export function repositorioNovedadesPrisma(cliente: ClienteBase = clientePorDefecto): RepositorioNovedades {
  const masNuevasPrimero = { orderBy: { creadoEn: "desc" } } as const;

  return {
    async crear(datos) {
      return aDominio((await cliente.novedad.create({ data: aFila(datos) as never })) as FilaNovedad);
    },
    async actualizar(id, cambios) {
      return aDominio((await cliente.novedad.update({ where: { id }, data: aFila(cambios) as never })) as FilaNovedad);
    },
    async porId(id) {
      const fila = (await cliente.novedad.findUnique({ where: { id } })) as FilaNovedad | null;
      return fila ? aDominio(fila) : null;
    },
    async delCaso(casoId) {
      const filas = (await cliente.novedad.findMany({ where: { casoId, archivada: false }, ...masNuevasPrimero })) as FilaNovedad[];
      return filas.map(aDominio);
    },
    async delAnimal(animalId) {
      const filas = (await cliente.novedad.findMany({ where: { animalId, archivada: false }, ...masNuevasPrimero })) as FilaNovedad[];
      return filas.map(aDominio);
    },
    async todasDelCaso(casoId) {
      const filas = (await cliente.novedad.findMany({ where: { casoId }, ...masNuevasPrimero })) as FilaNovedad[];
      return filas.map(aDominio);
    },
    async todasDelAnimal(animalId) {
      const filas = (await cliente.novedad.findMany({ where: { animalId }, ...masNuevasPrimero })) as FilaNovedad[];
      return filas.map(aDominio);
    },
  };
}
