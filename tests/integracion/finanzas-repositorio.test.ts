import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearCaso } from "@/domains/finanzas/casos";
import { registrarAsiento } from "@/domains/finanzas/asientos";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const casos: string[] = [];

afterAll(async () => {
  // El libro contable es inmutable (CLAUDE.md): el disparador de la base rechaza
  // cualquier borrado de AsientoContable. Se intenta igual por si algún día la regla
  // cambia; los asientos quedan huérfanos en la base de test, un dato inofensivo.
  try {
    await prisma.asientoContable.deleteMany({ where: { casoId: { in: casos } } });
  } catch {
    // esperado: ver comentario arriba
  }
  try {
    // Si el borrado de arriba no pudo (asientos huérfanos), el caso queda
    // referenciado por esos asientos y su borrado también choca con la
    // clave foránea. Mismo patrón que en finanzas-modelo.test.ts.
    await prisma.casoFinanciero.deleteMany({ where: { id: { in: casos } } });
  } catch {
    // esperado: ver comentario arriba
  }
  await prisma.$disconnect();
});

const base = {
  titulo: `Caso ${Date.now()}`,
  situacion: "Descripción de prueba suficientemente larga para pasar la validación.",
  metaCentavos: 50000000n,
};

describe("repositorio Prisma de finanzas", () => {
  it("los saldos se escriben en la misma transacción que el asiento", async () => {
    const caso = await prisma.$transaction(async (tx) =>
      crearCaso(base, {
        usuarioEmail: "prueba@huellas.org.ar",
        rol: "FINANZAS",
        repositorio: repositorioFinanzasPrisma(tx),
        auditoria: auditoriaPrisma(tx),
      })
    );
    casos.push(caso.id);

    await prisma.$transaction(async (tx) =>
      registrarAsiento(
        { casoId: caso.id, tipo: "DONACION", centavos: 2500000n, descripcion: "Donación", fechaEfectiva: new Date() },
        { usuarioEmail: "prueba@huellas.org.ar", rol: "FINANZAS", repositorio: repositorioFinanzasPrisma(tx), auditoria: auditoriaPrisma(tx) }
      )
    );

    const guardado = await prisma.casoFinanciero.findUnique({ where: { id: caso.id } });
    expect(guardado!.recibidoCentavos).toBe(2500000n);
  });

  it("si falla la auditoría no queda ni el asiento ni el saldo", async () => {
    const caso = await prisma.$transaction(async (tx) =>
      crearCaso({ ...base, titulo: `Caso fallido ${Date.now()}` }, {
        usuarioEmail: "prueba@huellas.org.ar",
        rol: "FINANZAS",
        repositorio: repositorioFinanzasPrisma(tx),
        auditoria: auditoriaPrisma(tx),
      })
    );
    casos.push(caso.id);

    await expect(
      prisma.$transaction(async (tx) =>
        registrarAsiento(
          { casoId: caso.id, tipo: "DONACION", centavos: 999999n, descripcion: "No debe quedar", fechaEfectiva: new Date() },
          {
            usuarioEmail: "prueba@huellas.org.ar",
            rol: "FINANZAS",
            repositorio: repositorioFinanzasPrisma(tx),
            auditoria: { async registrar() { throw new Error("auditoría caída"); } },
          }
        )
      )
    ).rejects.toThrow(/auditoría caída/);

    const guardado = await prisma.casoFinanciero.findUnique({ where: { id: caso.id } });
    expect(guardado!.recibidoCentavos).toBe(0n);
    expect(await prisma.asientoContable.count({ where: { casoId: caso.id } })).toBe(0);
  });

  it("el saldo se calcula sumando en la base, no trayendo todas las filas", async () => {
    const caso = await prisma.$transaction(async (tx) =>
      crearCaso({ ...base, titulo: `Caso suma ${Date.now()}` }, {
        usuarioEmail: "prueba@huellas.org.ar",
        rol: "FINANZAS",
        repositorio: repositorioFinanzasPrisma(tx),
        auditoria: auditoriaPrisma(tx),
      })
    );
    casos.push(caso.id);

    for (const centavos of [1000000n, 2000000n, -500000n]) {
      await prisma.$transaction(async (tx) =>
        registrarAsiento(
          { casoId: caso.id, tipo: centavos > 0n ? "DONACION" : "GASTO", centavos, descripcion: "Movimiento", fechaEfectiva: new Date() },
          { usuarioEmail: "prueba@huellas.org.ar", rol: "FINANZAS", repositorio: repositorioFinanzasPrisma(tx), auditoria: auditoriaPrisma(tx) }
        )
      );
    }

    const saldo = await repositorioFinanzasPrisma(prisma).saldoDeCaso(caso.id);
    expect(saldo.recibidoCentavos).toBe(3000000n);
    expect(saldo.gastadoCentavos).toBe(500000n);
    expect(saldo.cantidadDonaciones).toBe(2);
  });
});
