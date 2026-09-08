import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import type { Asiento, Caso, Documento, FiltroCasos, Intencion, RepositorioFinanzas, SaldoDelCaso } from "@/domains/finanzas/tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

export function repositorioFinanzasPrisma(cliente: ClienteBase = clientePorDefecto): RepositorioFinanzas {
  return {
    async crearCaso(datos) {
      return (await cliente.casoFinanciero.create({ data: datos as never })) as unknown as Caso;
    },
    async actualizarCaso(id, cambios) {
      return (await cliente.casoFinanciero.update({ where: { id }, data: cambios as never })) as unknown as Caso;
    },
    async casoPorId(id) {
      return (await cliente.casoFinanciero.findUnique({ where: { id } })) as unknown as Caso | null;
    },
    async casoPorSlug(slug) {
      return (await cliente.casoFinanciero.findUnique({ where: { slug } })) as unknown as Caso | null;
    },
    async slugsDeCasos() {
      const filas = await cliente.casoFinanciero.findMany({ select: { slug: true } });
      return filas.map((f) => f.slug);
    },
    async listarCasos(filtro: FiltroCasos) {
      return (await cliente.casoFinanciero.findMany({
        where: {
          AND: [
            filtro.estado ? { estado: filtro.estado } : {},
            filtro.soloAbiertos ? { estado: { not: "CERRADO" } } : {},
          ],
        },
        orderBy: [{ creadoEn: "desc" }],
      })) as unknown as Caso[];
    },

    async crearAsiento(datos) {
      return (await cliente.asientoContable.create({ data: datos as never })) as unknown as Asiento;
    },
    async asientosDeCaso(casoId) {
      return (await cliente.asientoContable.findMany({
        where: { casoId },
        orderBy: [{ fechaEfectiva: "asc" }, { creadoEn: "asc" }],
      })) as unknown as Asiento[];
    },

    /**
     * La suma la hace la base, no la aplicación: un caso viral puede tener
     * miles de asientos y traerlos todos para sumarlos en memoria sería
     * lento y, con el tiempo, imposible.
     */
    async saldoDeCaso(casoId) {
      const [entradas, salidas, donaciones] = await Promise.all([
        cliente.asientoContable.aggregate({ where: { casoId, centavos: { gt: 0 } }, _sum: { centavos: true } }),
        cliente.asientoContable.aggregate({ where: { casoId, centavos: { lt: 0 } }, _sum: { centavos: true } }),
        cliente.asientoContable.count({ where: { casoId, tipo: "DONACION" } }),
      ]);
      const recibidoCentavos = entradas._sum.centavos ?? 0n;
      const negativo = salidas._sum.centavos ?? 0n;
      return {
        recibidoCentavos,
        gastadoCentavos: negativo < 0n ? -negativo : 0n,
        cantidadDonaciones: donaciones,
      } satisfies SaldoDelCaso;
    },

    async asientoPorPagoExterno(proveedor, pagoExternoId) {
      return (await cliente.asientoContable.findFirst({
        where: { proveedor, pagoExternoId },
      })) as unknown as Asiento | null;
    },

    async crearIntencion(datos) {
      return (await cliente.intencionDonacion.create({ data: datos as never })) as unknown as Intencion;
    },
    async intencionPorId(id) {
      return (await cliente.intencionDonacion.findUnique({ where: { id } })) as unknown as Intencion | null;
    },
    async actualizarIntencion(id, cambios) {
      return (await cliente.intencionDonacion.update({ where: { id }, data: cambios as never })) as unknown as Intencion;
    },
    async intencionesPendientes() {
      return (await cliente.intencionDonacion.findMany({
        where: { estado: "PENDIENTE_VERIFICACION" },
        orderBy: [{ creadoEn: "asc" }],
      })) as unknown as Intencion[];
    },

    async crearDocumento(datos) {
      return (await cliente.documento.create({ data: datos as never })) as unknown as Documento;
    },
    async documentoPorId(id) {
      return (await cliente.documento.findUnique({ where: { id } })) as unknown as Documento | null;
    },
  };
}
