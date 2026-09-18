import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { repositorioPostulacionesPrisma } from "@/infra/repositorios/postulaciones";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { repositorioAvisosPrisma } from "@/infra/repositorios/avisos";
import { puertoAvisos } from "@/domains/avisos/cola";
import { enviarPostulacion } from "@/domains/postulaciones/envio";
import { crearPregunta } from "@/domains/postulaciones/preguntas";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const animales: string[] = [];
const preguntas: string[] = [];

afterAll(async () => {
  const ids = await prisma.postulacion.findMany({ where: { animalId: { in: animales } }, select: { id: true } });
  await prisma.respuestaPostulacion.deleteMany({ where: { postulacionId: { in: ids.map((p) => p.id) } } });
  await prisma.postulacion.deleteMany({ where: { animalId: { in: animales } } });
  await prisma.preguntaFormulario.deleteMany({ where: { id: { in: preguntas } } });
  await prisma.animal.deleteMany({ where: { id: { in: animales } } });
  await prisma.$disconnect();
});

async function animalDePrueba() {
  const animal = await prisma.animal.create({
    data: {
      slug: `repo-postulaciones-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

describe("repositorio Prisma de postulaciones", () => {
  it("guarda la postulación y sus respuestas en una sola transacción", async () => {
    const animal = await animalDePrueba();

    const pregunta = await prisma.$transaction(async (tx) =>
      crearPregunta(
        { texto: "¿Tenés patio cerrado?", tipo: "SI_NO", obligatoria: true },
        {
          usuarioEmail: "prueba@huellas.org.ar",
          rol: "ANIMALES",
          repositorio: repositorioPostulacionesPrisma(tx),
          auditoria: auditoriaPrisma(tx),
          avisos: puertoAvisos(repositorioAvisosPrisma(tx)),
        }
      )
    );
    preguntas.push(pregunta.id);

    const { postulacion } = await prisma.$transaction(async (tx) =>
      enviarPostulacion(
        {
          animalId: animal.id,
          nombreAnimal: animal.nombre,
          nombre: "Marina",
          email: "marina@ejemplo.org",
          telefono: "341 555 0000",
          respuestas: { [pregunta.id]: "sí" },
        },
        repositorioPostulacionesPrisma(tx),
        auditoriaPrisma(tx),
        puertoAvisos(repositorioAvisosPrisma(tx))
      )
    );

    const guardadas = await prisma.respuestaPostulacion.findMany({ where: { postulacionId: postulacion.id } });
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0].textoPregunta).toBe("¿Tenés patio cerrado?");
  });

  it("si falla la auditoría no queda ni la postulación ni sus respuestas", async () => {
    const animal = await animalDePrueba();
    const antes = await prisma.postulacion.count({ where: { animalId: animal.id } });

    await expect(
      prisma.$transaction(async (tx) =>
        enviarPostulacion(
          {
            animalId: animal.id,
            nombreAnimal: animal.nombre,
            nombre: "No debe quedar",
            email: "no@ejemplo.org",
            telefono: "341 555 0000",
            respuestas: { [preguntas[0]]: "sí" },
          },
          repositorioPostulacionesPrisma(tx),
          { async registrar() { throw new Error("auditoría caída"); } },
          puertoAvisos(repositorioAvisosPrisma(tx))
        )
      )
    ).rejects.toThrow(/auditoría caída/);

    expect(await prisma.postulacion.count({ where: { animalId: animal.id } })).toBe(antes);
  });

  it("encuentra una postulación reciente del mismo correo y animal", async () => {
    const animal = await animalDePrueba();
    const { postulacion } = await prisma.$transaction(async (tx) =>
      enviarPostulacion(
        {
          animalId: animal.id,
          nombreAnimal: animal.nombre,
          nombre: "Marina",
          email: "Marina@Ejemplo.org",
          telefono: "341 555 0000",
          respuestas: { [preguntas[0]]: "sí" },
        },
        repositorioPostulacionesPrisma(tx),
        auditoriaPrisma(tx),
        puertoAvisos(repositorioAvisosPrisma(tx))
      )
    );

    const hace5Minutos = new Date(Date.now() - 5 * 60 * 1000);
    // El correo se guarda en minúsculas: la búsqueda tiene que encontrarlo igual.
    const encontrada = await repositorioPostulacionesPrisma(prisma).postulacionRecienteDe(
      animal.id,
      "marina@ejemplo.org",
      hace5Minutos
    );
    expect(encontrada?.id).toBe(postulacion.id);
  });
});
