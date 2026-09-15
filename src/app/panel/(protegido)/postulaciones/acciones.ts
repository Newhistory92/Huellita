"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/infra/prisma";
import { auth } from "@/infra/auth";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { conContextoPostulaciones } from "../formulario/acciones";
import { cambiarEstado, borrarDatosPersonales, cerrarOtrasPostulaciones } from "@/domains/postulaciones/gestion";
import { cambiarEstado as cambiarEstadoAnimal } from "@/domains/animales/servicio";
import type { Contexto as ContextoAnimales, EstadoAnimal } from "@/domains/animales/tipos";
import type { EstadoPostulacion } from "@/domains/postulaciones/tipos";

export async function accionCambiarEstado(id: string, estado: EstadoPostulacion, comentario: string | null) {
  await conContextoPostulaciones((ctx) => cambiarEstado(id, estado, comentario, ctx));
  revalidatePath("/panel/postulaciones");
}

export async function accionBorrarDatosPersonales(id: string) {
  await conContextoPostulaciones((ctx) => borrarDatosPersonales(id, ctx));
  revalidatePath("/panel/postulaciones");
}

export async function accionCerrarOtras(animalId: string, exceptoId: string) {
  const cerradas = await conContextoPostulaciones((ctx) => cerrarOtrasPostulaciones(animalId, exceptoId, ctx));
  revalidatePath("/panel/postulaciones");
  return cerradas;
}

/**
 * Cambia el estado del animal. Es una acción aparte, y a propósito: el dominio
 * de postulaciones no toca animales. Esto lo dispara una persona desde el
 * panel, después de que el sistema se lo ofrece.
 */
export async function accionMarcarAnimal(animalId: string, estado: EstadoAnimal) {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  await prisma.$transaction(async (tx) =>
    cambiarEstadoAnimal(animalId, estado, {
      usuarioEmail: sesion.user.email!,
      // El rol real, no uno inventado para conformar al tipo. Escribir
      // `as "ADMINISTRACION"` acá dejaría pasar a cualquiera: el dominio
      // verifica el permiso sobre lo que reciba, y recibiría una mentira.
      rol: sesion.user.rol as ContextoAnimales["rol"],
      repositorio: repositorioPrisma(tx),
      auditoria: auditoriaPrisma(tx),
    })
  );
  revalidatePath("/panel/postulaciones");
}
