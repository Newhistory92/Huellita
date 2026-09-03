"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/infra/auth";
import { prisma } from "@/infra/prisma";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearAnimal, editarAnimal, publicarAnimal, cambiarEstado, archivarAnimal } from "@/domains/animales/servicio";
import type { Contexto, EstadoAnimal } from "@/domains/animales/tipos";
import type { EntradaAnimal } from "@/domains/animales/esquemas";

/** Arma el contexto de dominio para una transacción. Único punto de entrada del panel. */
async function conContexto<T>(fn: (ctx: Contexto) => Promise<T>): Promise<T> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  return prisma.$transaction(async (tx) =>
    fn({
      usuarioEmail: sesion.user.email!,
      rol: sesion.user.rol as Contexto["rol"],
      repositorio: repositorioPrisma(tx),
      auditoria: auditoriaPrisma(tx),
    })
  );
}

function entradaDesdeFormulario(formulario: FormData): EntradaAnimal {
  const opcional = (clave: string) => {
    const valor = String(formulario.get(clave) ?? "").trim();
    return valor === "" ? undefined : valor;
  };

  return {
    nombre: String(formulario.get("nombre") ?? ""),
    especie: formulario.get("especie") as EntradaAnimal["especie"],
    sexo: formulario.get("sexo") as EntradaAnimal["sexo"],
    tamano: formulario.get("tamano") as EntradaAnimal["tamano"],
    descripcion: String(formulario.get("descripcion") ?? ""),
    personalidad: opcional("personalidad"),
    zona: opcional("zona"),
    requisitos: opcional("requisitos"),
    castrado: formulario.get("castrado") === "on",
    vacunasAlDia: formulario.get("vacunasAlDia") === "on",
  };
}

export async function accionCrearAnimal(formulario: FormData) {
  const animal = await conContexto((ctx) => crearAnimal(entradaDesdeFormulario(formulario), ctx));
  redirect(`/panel/animales/${animal.id}`);
}

export async function accionEditarAnimal(id: string, formulario: FormData) {
  const animal = await conContexto((ctx) => editarAnimal(id, entradaDesdeFormulario(formulario), ctx));
  revalidateTag("animales");
  revalidateTag(`animal:${animal.slug}`);
}

export async function accionPublicarAnimal(id: string) {
  const animal = await conContexto((ctx) => publicarAnimal(id, ctx));
  // Regenera la ficha y el listado. Sin esto, la página estática queda vieja.
  revalidateTag("animales");
  revalidateTag(`animal:${animal.slug}`);
}

export async function accionCambiarEstado(id: string, estado: EstadoAnimal) {
  const animal = await conContexto((ctx) => cambiarEstado(id, estado, ctx));
  revalidateTag("animales");
  revalidateTag(`animal:${animal.slug}`);
}

export async function accionArchivarAnimal(id: string) {
  const animal = await conContexto((ctx) => archivarAnimal(id, ctx));
  revalidateTag("animales");
  revalidateTag(`animal:${animal.slug}`);
}
