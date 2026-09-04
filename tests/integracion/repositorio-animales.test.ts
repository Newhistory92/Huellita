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
    // El nombre es único por corrida y la verificación mira solo ese animal.
    // Contar el total de la tabla volvía la prueba inestable: Vitest corre los
    // archivos en paralelo contra la misma base, así que otro archivo podía
    // insertar una fila entre la medición inicial y la final.
    const nombre = `Fallará ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await expect(
      prisma.$transaction(async (tx) =>
        crearAnimal(
          { nombre, especie: "PERRO", sexo: "MACHO", tamano: "MEDIANO", descripcion: "Descripción de prueba suficientemente larga." },
          {
            usuarioEmail: "prueba@huellas.org.ar",
            rol: "ANIMALES",
            repositorio: repositorioPrisma(tx),
            auditoria: { async registrar() { throw new Error("auditoría caída"); } },
          }
        )
      )
    ).rejects.toThrow(/auditoría caída/);

    expect(await prisma.animal.count({ where: { nombre } })).toBe(0);
  });
});
