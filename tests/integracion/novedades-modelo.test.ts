import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const animales: string[] = [];
const casos: string[] = [];
const novedades: string[] = [];

afterAll(async () => {
  await prisma.novedad.deleteMany({ where: { id: { in: novedades } } });
  await prisma.casoFinanciero.deleteMany({ where: { id: { in: casos } } });
  await prisma.animal.deleteMany({ where: { id: { in: animales } } });
  await prisma.$disconnect();
});

const sufijo = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function animalDePrueba() {
  const animal = await prisma.animal.create({
    data: {
      slug: `novedades-${sufijo()}`,
      nombre: "Juanito",
      especie: "PERRO",
      sexo: "MACHO",
      tamano: "MEDIANO",
      descripcion: "Descripción de prueba suficientemente larga para pasar la validación.",
    },
  });
  animales.push(animal.id);
  return animal;
}

async function casoDePrueba() {
  const caso = await prisma.casoFinanciero.create({
    data: { slug: `caso-novedades-${sufijo()}`, titulo: "Caso", situacion: "x", metaCentavos: 100000n },
  });
  casos.push(caso.id);
  return caso;
}

describe("modelo de novedades", () => {
  it("guarda una novedad colgada de un caso", async () => {
    const caso = await casoDePrueba();
    const novedad = await prisma.novedad.create({
      data: { casoId: caso.id, titulo: "Luna salió bien de la cirugía", cuerpo: "Está estable.", autorEmail: "marina@huellas.org.ar" },
    });
    novedades.push(novedad.id);

    expect(novedad.animalId).toBeNull();
    expect(novedad.archivada).toBe(false);
  });

  it("guarda una novedad colgada de un animal, con foto", async () => {
    const animal = await animalDePrueba();
    const novedad = await prisma.novedad.create({
      data: {
        animalId: animal.id,
        titulo: "Juanito ya está recuperado",
        cuerpo: "Come bien y duerme panza arriba.",
        autorEmail: "marina@huellas.org.ar",
        fotoClave: "novedades/abc",
        fotoAlt: "Juanito durmiendo panza arriba",
        fotoAncho: 1200,
        fotoAlto: 900,
        fotoPlaceholder: "data:image/webp;base64,xx",
      },
    });
    novedades.push(novedad.id);

    expect(novedad.casoId).toBeNull();
    expect(novedad.fotoAlt).toBe("Juanito durmiendo panza arriba");
  });

  it("se puede leer desde el caso y desde el animal", async () => {
    const caso = await casoDePrueba();
    const novedad = await prisma.novedad.create({
      data: { casoId: caso.id, titulo: "Actualización", cuerpo: "x", autorEmail: "a@b.c" },
    });
    novedades.push(novedad.id);

    const conNovedades = await prisma.casoFinanciero.findUnique({
      where: { id: caso.id },
      include: { novedades: true },
    });
    expect(conNovedades!.novedades).toHaveLength(1);
  });
});
