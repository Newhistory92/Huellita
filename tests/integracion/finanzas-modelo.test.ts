import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const casos: string[] = [];

afterAll(async () => {
  await prisma.asientoContable.deleteMany({ where: { casoId: { in: casos } } });
  await prisma.intencionDonacion.deleteMany({ where: { casoId: { in: casos } } });
  await prisma.casoFinanciero.deleteMany({ where: { id: { in: casos } } });
  await prisma.$disconnect();
});

async function casoDePrueba() {
  const caso = await prisma.casoFinanciero.create({
    data: { slug: `caso-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, titulo: "Prueba", situacion: "x", metaCentavos: 100000n },
  });
  casos.push(caso.id);
  return caso;
}

describe("modelo de la entrega 2", () => {
  it("guarda una intención de donación con la preferencia de anonimato", async () => {
    const caso = await casoDePrueba();
    const intencion = await prisma.intencionDonacion.create({
      data: { casoId: caso.id, centavos: 5000n, proveedor: "mercadopago", nombreDonante: "Marina", publicarNombre: true },
    });
    expect(intencion.estado).toBe("INICIADA");
    expect(intencion.publicarNombre).toBe(true);
  });

  it("una intención produce a lo sumo un asiento", async () => {
    const caso = await casoDePrueba();
    const intencion = await prisma.intencionDonacion.create({
      data: { casoId: caso.id, centavos: 5000n, proveedor: "mercadopago" },
    });
    await prisma.asientoContable.create({
      data: { casoId: caso.id, tipo: "DONACION", centavos: 5000n, descripcion: "Donación", fechaEfectiva: new Date(), intencionId: intencion.id },
    });
    await expect(
      prisma.asientoContable.create({
        data: { casoId: caso.id, tipo: "DONACION", centavos: 5000n, descripcion: "Duplicada", fechaEfectiva: new Date(), intencionId: intencion.id },
      })
    ).rejects.toThrow();
  });

  it("no admite dos asientos para el mismo pago del mismo proveedor", async () => {
    const caso = await casoDePrueba();
    const pago = `pago-${Date.now()}`;
    await prisma.asientoContable.create({
      data: { casoId: caso.id, tipo: "DONACION", centavos: 5000n, descripcion: "Donación", fechaEfectiva: new Date(), proveedor: "mercadopago", pagoExternoId: pago },
    });
    await expect(
      prisma.asientoContable.create({
        data: { casoId: caso.id, tipo: "DONACION", centavos: 5000n, descripcion: "Repetida", fechaEfectiva: new Date(), proveedor: "mercadopago", pagoExternoId: pago },
      })
    ).rejects.toThrow();
  });
});
