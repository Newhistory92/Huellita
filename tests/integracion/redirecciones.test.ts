import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearAnimal } from "@/domains/animales/servicio";
import { buscarSlugActual } from "@/domains/animales/consultas";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const creados: string[] = [];
const slugsViejos: string[] = [];

afterAll(async () => {
  await prisma.redireccionDireccion.deleteMany({ where: { slugAnterior: { in: slugsViejos } } });
  await prisma.registroAuditoria.deleteMany({ where: { entidadId: { in: creados } } });
  await prisma.animal.deleteMany({ where: { id: { in: creados } } });
  await prisma.$disconnect();
});

describe("buscarSlugActual", () => {
  it("sigue una dirección vieja hasta la dirección actual del animal", async () => {
    const nombre = `Prueba ${Date.now()}`;
    const animal = await prisma.$transaction(async (tx) =>
      crearAnimal(
        { nombre, especie: "PERRO", sexo: "MACHO", tamano: "MEDIANO", descripcion: "Descripción de prueba suficientemente larga." },
        {
          usuarioEmail: "prueba@huellas.org.ar",
          rol: "ANIMALES",
          repositorio: repositorioPrisma(tx),
          auditoria: auditoriaPrisma(tx),
        }
      )
    );
    creados.push(animal.id);

    const slugAnterior = `${animal.slug}-antes-de-corregir`;
    slugsViejos.push(slugAnterior);
    await prisma.redireccionDireccion.create({ data: { slugAnterior, animalId: animal.id } });

    expect(await buscarSlugActual(slugAnterior, prisma)).toBe(animal.slug);
  });

  it("devuelve null para una dirección que nunca existió", async () => {
    expect(await buscarSlugActual("esto-nunca-existio", prisma)).toBeNull();
  });
});
