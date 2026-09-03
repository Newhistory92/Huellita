import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import type { Foto, RepositorioFotos } from "@/domains/animales/tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

export function repositorioFotosPrisma(cliente: ClienteBase = clientePorDefecto): RepositorioFotos {
  return {
    async crear(datos) {
      return (await cliente.fotoAnimal.create({ data: datos as never })) as unknown as Foto;
    },
    async listarPorAnimal(animalId) {
      return (await cliente.fotoAnimal.findMany({
        where: { animalId },
        orderBy: { orden: "asc" },
      })) as unknown as Foto[];
    },
    async porId(id) {
      return (await cliente.fotoAnimal.findUnique({ where: { id } })) as unknown as Foto | null;
    },
    async actualizar(id, cambios) {
      return (await cliente.fotoAnimal.update({ where: { id }, data: cambios as never })) as unknown as Foto;
    },
    async reordenar(cambios) {
      for (const cambio of cambios) {
        await cliente.fotoAnimal.update({ where: { id: cambio.id }, data: { orden: cambio.orden } });
      }
    },
  };
}
