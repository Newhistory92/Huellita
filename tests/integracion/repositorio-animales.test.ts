import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearAnimal } from "@/domains/animales/servicio";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const creados: string[] = [];

afterAll(async () => {
  await prisma.registroAuditoria.deleteMany({ where: { entidadId: { in: creados } } });
  await prisma.animal.deleteMany({ where: { id: { in: creados } } });
  await prisma.$disconnect();
});

describe("repositorio Prisma de animales", () => {
  it("guarda y recupera por dirección permanente", async () => {
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

    const recuperado = await repositorioPrisma(prisma).porSlug(animal.slug);
    expect(recuperado?.nombre).toBe(nombre);
  });

  it("si falla la auditoría, no queda el animal: van en la misma transacción", async () => {
    const antes = await prisma.animal.count();
    await expect(
      prisma.$transaction(async (tx) =>
        crearAnimal(
          { nombre: "Fallará", especie: "PERRO", sexo: "MACHO", tamano: "MEDIANO", descripcion: "Descripción de prueba suficientemente larga." },
          {
            usuarioEmail: "prueba@huellas.org.ar",
            rol: "ANIMALES",
            repositorio: repositorioPrisma(tx),
            auditoria: { async registrar() { throw new Error("auditoría caída"); } },
          }
        )
      )
    ).rejects.toThrow(/auditoría caída/);
    expect(await prisma.animal.count()).toBe(antes);
  });
});
