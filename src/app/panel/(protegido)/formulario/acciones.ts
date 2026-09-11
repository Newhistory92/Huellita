"use server";

import { revalidateTag } from "next/cache";
import { auth } from "@/infra/auth";
import { prisma } from "@/infra/prisma";
import { repositorioPostulacionesPrisma } from "@/infra/repositorios/postulaciones";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearPregunta, editarPregunta, archivarPregunta, reordenarPreguntas } from "@/domains/postulaciones/preguntas";
import type { ContextoPostulaciones, TipoRespuesta } from "@/domains/postulaciones/tipos";

export async function conContextoPostulaciones<T>(fn: (ctx: ContextoPostulaciones) => Promise<T>): Promise<T> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  return prisma.$transaction(async (tx) =>
    fn({
      usuarioEmail: sesion.user.email!,
      rol: sesion.user.rol as ContextoPostulaciones["rol"],
      repositorio: repositorioPostulacionesPrisma(tx),
      auditoria: auditoriaPrisma(tx),
    })
  );
}

export async function accionCrearPregunta(formulario: FormData) {
  const opcionesCrudas = String(formulario.get("opciones") ?? "").trim();
  await conContextoPostulaciones((ctx) =>
    crearPregunta(
      {
        texto: String(formulario.get("texto") ?? ""),
        tipo: String(formulario.get("tipo") ?? "TEXTO_CORTO") as TipoRespuesta,
        ayuda: String(formulario.get("ayuda") ?? "").trim() || null,
        // Una opción por línea: es lo que espera quien escribe una lista.
        opciones: opcionesCrudas.length > 0 ? opcionesCrudas.split("\n").map((o) => o.trim()).filter(Boolean) : [],
        obligatoria: formulario.get("obligatoria") === "on",
        animalId: (formulario.get("animalId") as string) || null,
      },
      ctx
    )
  );
  revalidateTag("formulario");
}

export async function accionEditarPregunta(id: string, formulario: FormData) {
  await conContextoPostulaciones((ctx) =>
    editarPregunta(
      id,
      {
        texto: String(formulario.get("texto") ?? ""),
        ayuda: String(formulario.get("ayuda") ?? "").trim() || null,
        obligatoria: formulario.get("obligatoria") === "on",
      },
      ctx
    )
  );
  revalidateTag("formulario");
}

export async function accionArchivarPregunta(id: string) {
  await conContextoPostulaciones((ctx) => archivarPregunta(id, ctx));
  revalidateTag("formulario");
}

export async function accionReordenar(idsEnOrden: string[]) {
  await conContextoPostulaciones((ctx) => reordenarPreguntas(idsEnOrden, ctx));
  revalidateTag("formulario");
}
