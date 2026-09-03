import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });

let casoId: string;
let asientoId: string;

beforeAll(async () => {
  const caso = await prisma.casoFinanciero.create({
    data: { slug: `prueba-${Date.now()}`, titulo: "Caso de prueba", situacion: "x", metaCentavos: 100n },
  });
  casoId = caso.id;
  const asiento = await prisma.asientoContable.create({
    data: {
      casoId,
      tipo: "DONACION",
      centavos: 5000n,
      descripcion: "Donación de prueba",
      fechaEfectiva: new Date(),
    },
  });
  asientoId = asiento.id;
});

afterAll(async () => {
  // El caso queda con asientos que ya nunca se pueden borrar (esa es la regla
  // que este archivo prueba), así que el borrado de limpieza siempre choca
  // contra la restricción de clave foránea. Se intenta igual por si algún día
  // el disparador cambia, pero el caso de prueba queda huérfano en la base de
  // test — es un dato inofensivo, no un fallo del código.
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "CasoFinanciero" WHERE id = $1`, casoId);
  } catch {
    // esperado: ver comentario arriba
  }
  await prisma.$disconnect();
});

describe("el libro contable es solo de agregado", () => {
  it("rechaza modificar un asiento", async () => {
    await expect(
      prisma.asientoContable.update({ where: { id: asientoId }, data: { centavos: 999999n } })
    ).rejects.toThrow(/inmutable/i);
  });

  it("rechaza borrar un asiento", async () => {
    await expect(
      prisma.asientoContable.delete({ where: { id: asientoId } })
    ).rejects.toThrow(/inmutable/i);
  });

  it("permite agregar un asiento de ajuste que corrige al anterior", async () => {
    const ajuste = await prisma.asientoContable.create({
      data: {
        casoId,
        tipo: "AJUSTE",
        centavos: -5000n,
        descripcion: "Contracargo del pago",
        ajustaAId: asientoId,
        fechaEfectiva: new Date(),
      },
    });
    expect(ajuste.ajustaAId).toBe(asientoId);
  });
});
