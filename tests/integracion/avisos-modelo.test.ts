import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const avisos: string[] = [];

afterAll(async () => {
  await prisma.avisoPendiente.deleteMany({ where: { id: { in: avisos } } });
  await prisma.$disconnect();
});

describe("modelo de la cola de avisos", () => {
  it("un aviso nace pendiente, sin intentos", async () => {
    const aviso = await prisma.avisoPendiente.create({
      data: { tipo: "POSTULACION_NUEVA", datos: { animalId: "animal-1", nombreAnimal: "Juanito" } },
    });
    avisos.push(aviso.id);

    expect(aviso.enviadoEn).toBeNull();
    expect(aviso.intentos).toBe(0);
    expect(aviso.ultimoError).toBeNull();
  });

  it("guarda quién originó la acción, para no avisarle a esa persona", async () => {
    const aviso = await prisma.avisoPendiente.create({
      data: { tipo: "TRANSFERENCIA_PENDIENTE", datos: {}, originadoPorEmail: "carla@huellas.org.ar" },
    });
    avisos.push(aviso.id);
    expect(aviso.originadoPorEmail).toBe("carla@huellas.org.ar");
  });

  it("se consultan los pendientes por el índice de enviadoEn", async () => {
    const pendiente = await prisma.avisoPendiente.create({ data: { tipo: "META_ALCANZADA", datos: {} } });
    const enviado = await prisma.avisoPendiente.create({
      data: { tipo: "META_ALCANZADA", datos: {}, enviadoEn: new Date() },
    });
    avisos.push(pendiente.id, enviado.id);

    const pendientes = await prisma.avisoPendiente.findMany({ where: { enviadoEn: null, id: { in: avisos } } });
    expect(pendientes.map((a) => a.id)).toContain(pendiente.id);
    expect(pendientes.map((a) => a.id)).not.toContain(enviado.id);
  });
});
