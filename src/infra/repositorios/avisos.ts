import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import type { AvisoPendiente, RepositorioAvisos, Rol } from "@/domains/avisos/tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

export function repositorioAvisosPrisma(cliente: ClienteBase = clientePorDefecto): RepositorioAvisos {
  return {
    async anotar(aviso) {
      await cliente.avisoPendiente.create({
        data: {
          tipo: aviso.tipo,
          datos: aviso.datos as never,
          originadoPorEmail: aviso.originadoPorEmail ?? null,
        },
      });
    },
    async pendientes(limite, maxIntentos) {
      return (await cliente.avisoPendiente.findMany({
        where: { enviadoEn: null, intentos: { lt: maxIntentos } },
        orderBy: { creadoEn: "asc" },
        take: limite,
      })) as unknown as AvisoPendiente[];
    },
    async marcarEnviados(ids, cuando) {
      await cliente.avisoPendiente.updateMany({ where: { id: { in: ids } }, data: { enviadoEn: cuando } });
    },
    async registrarFallo(ids, error) {
      await cliente.avisoPendiente.updateMany({
        where: { id: { in: ids } },
        data: { intentos: { increment: 1 }, ultimoError: error.slice(0, 500) },
      });
    },
    async correosDeRoles(roles: Rol[]) {
      const usuarios = await cliente.usuario.findMany({
        where: { activo: true, rol: { in: roles as never } },
        select: { email: true },
      });
      return usuarios.map((u) => u.email);
    },
  };
}
