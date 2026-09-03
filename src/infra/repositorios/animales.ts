import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import type { Animal, FiltroAnimales, RepositorioAnimales, PuertoAuditoria } from "@/domains/animales/tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

export function repositorioPrisma(cliente: ClienteBase = clientePorDefecto): RepositorioAnimales {
  return {
    async crear(datos) {
      return (await cliente.animal.create({ data: datos as never })) as unknown as Animal;
    },
    async actualizar(id, cambios) {
      return (await cliente.animal.update({ where: { id }, data: cambios as never })) as unknown as Animal;
    },
    async porId(id) {
      return (await cliente.animal.findUnique({ where: { id } })) as unknown as Animal | null;
    },
    async porSlug(slug) {
      return (await cliente.animal.findUnique({ where: { slug } })) as unknown as Animal | null;
    },
    async slugsExistentes() {
      const filas = await cliente.animal.findMany({ select: { slug: true } });
      return filas.map((f) => f.slug);
    },
    async listar(filtro: FiltroAnimales) {
      return (await cliente.animal.findMany({
        where: {
          especie: filtro.especie,
          tamano: filtro.tamano,
          estado: filtro.estado,
          ...(filtro.soloPublicados ? { publicadoEn: { not: null }, archivado: false } : {}),
        },
        orderBy: [{ publicadoEn: "desc" }],
      })) as unknown as Animal[];
    },
  };
}

export function auditoriaPrisma(cliente: ClienteBase = clientePorDefecto): PuertoAuditoria {
  return {
    async registrar(entrada) {
      await cliente.registroAuditoria.create({
        data: {
          usuarioEmail: entrada.usuarioEmail,
          accion: entrada.accion,
          entidad: entrada.entidad,
          entidadId: entrada.entidadId,
          valorAnterior: (entrada.valorAnterior ?? null) as never,
          valorNuevo: (entrada.valorNuevo ?? null) as never,
        },
      });
    },
  };
}
