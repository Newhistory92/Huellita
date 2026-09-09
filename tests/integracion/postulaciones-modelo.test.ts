import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const animales: string[] = [];
const postulaciones: string[] = [];

afterAll(async () => {
  await prisma.respuestaPostulacion.deleteMany({ where: { postulacionId: { in: postulaciones } } });
  await prisma.postulacion.deleteMany({ where: { id: { in: postulaciones } } });
  await prisma.preguntaFormulario.deleteMany({ where: { animalId: { in: animales } } });
  await prisma.animal.deleteMany({ where: { id: { in: animales } } });
  await prisma.$disconnect();
});

async function animalDePrueba() {
  const animal = await prisma.animal.create({
    data: {
      slug: `postulaciones-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

describe("modelo de postulaciones", () => {
  it("guarda una postulación con sus respuestas", async () => {
    const animal = await animalDePrueba();
    const postulacion = await prisma.postulacion.create({
      data: {
        animalId: animal.id,
        nombre: "Marina Gómez",
        email: "marina@ejemplo.org",
        telefono: "341 555 0000",
        respuestas: {
          create: [
            { textoPregunta: "¿Tenés patio cerrado?", tipo: "SI_NO", valor: "sí", orden: 0 },
            { textoPregunta: "¿Por qué querés adoptarlo?", tipo: "TEXTO_LARGO", valor: "Porque sí.", orden: 1 },
          ],
        },
      },
      include: { respuestas: true },
    });
    postulaciones.push(postulacion.id);

    expect(postulacion.estado).toBe("NUEVA");
    expect(postulacion.respuestas).toHaveLength(2);
    expect(postulacion.anonimizadaEn).toBeNull();
  });

  it("una respuesta sobrevive a que la pregunta se archive", async () => {
    const animal = await animalDePrueba();
    const pregunta = await prisma.preguntaFormulario.create({
      data: { animalId: animal.id, texto: "¿Tenés experiencia con perros grandes?", tipo: "SI_NO", orden: 0 },
    });

    const postulacion = await prisma.postulacion.create({
      data: {
        animalId: animal.id,
        nombre: "Marina",
        email: "marina@ejemplo.org",
        telefono: "341 555 0000",
        respuestas: { create: [{ preguntaId: pregunta.id, textoPregunta: pregunta.texto, tipo: "SI_NO", valor: "sí", orden: 0 }] },
      },
      include: { respuestas: true },
    });
    postulaciones.push(postulacion.id);

    await prisma.preguntaFormulario.update({ where: { id: pregunta.id }, data: { archivada: true, texto: "Texto cambiado" } });

    const respuesta = await prisma.respuestaPostulacion.findFirst({ where: { postulacionId: postulacion.id } });
    // El recorte: la respuesta conserva lo que se preguntó de verdad.
    expect(respuesta!.textoPregunta).toBe("¿Tenés experiencia con perros grandes?");
  });

  it("una pregunta pertenece al formulario base o a un animal", async () => {
    const animal = await animalDePrueba();
    const delAnimal = await prisma.preguntaFormulario.create({
      data: { animalId: animal.id, texto: "Propia del animal", tipo: "TEXTO_CORTO", orden: 0 },
    });
    expect(delAnimal.formularioId).toBeNull();
    expect(delAnimal.animalId).toBe(animal.id);
  });
});
