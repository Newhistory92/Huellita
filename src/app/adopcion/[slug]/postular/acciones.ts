"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/infra/prisma";
import { repositorioPostulacionesPrisma } from "@/infra/repositorios/postulaciones";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { repositorioAvisosPrisma } from "@/infra/repositorios/avisos";
import { puertoAvisos } from "@/domains/avisos/cola";
import { enviarPostulacion } from "@/domains/postulaciones/envio";
import { animalPorSlug } from "@/domains/animales/consultas";

/** Los campos del contacto no son preguntas: el resto del formulario sí. */
const CAMPOS_DE_CONTACTO = new Set(["slug", "nombre", "email", "telefono"]);

export async function accionEnviarPostulacion(formulario: FormData) {
  const slug = String(formulario.get("slug") ?? "");
  const animal = await animalPorSlug(slug);
  if (!animal) throw new Error("No existe el animal");

  // Cada campo que no es de contacto es una respuesta, y su nombre es el
  // identificador de la pregunta. getAll cubre la selección múltiple.
  const respuestas: Record<string, string | string[]> = {};
  for (const clave of new Set(formulario.keys())) {
    if (CAMPOS_DE_CONTACTO.has(clave)) continue;
    const valores = formulario.getAll(clave).map(String);
    respuestas[clave] = valores.length > 1 ? valores : (valores[0] ?? "");
  }

  const { postulacion } = await prisma.$transaction(async (tx) =>
    enviarPostulacion(
      {
        animalId: animal.id,
        nombreAnimal: animal.nombre,
        nombre: String(formulario.get("nombre") ?? ""),
        email: String(formulario.get("email") ?? ""),
        telefono: String(formulario.get("telefono") ?? ""),
        respuestas,
      },
      repositorioPostulacionesPrisma(tx),
      auditoriaPrisma(tx),
      puertoAvisos(repositorioAvisosPrisma(tx))
    )
  );

  // Un envío repetido llega acá igual y ve la misma confirmación: desde su
  // lado funcionó, porque su postulación está registrada.
  redirect(`/adopcion/${slug}/postular/gracias?ref=${postulacion.id.slice(-5).toUpperCase()}`);
}
