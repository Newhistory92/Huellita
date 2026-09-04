"use server";

import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { auth } from "@/infra/auth";
import { prisma } from "@/infra/prisma";
import { repositorioFotosPrisma } from "@/infra/repositorios/fotos";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { almacen } from "@/infra/almacen";
import { exigirAlmacenPersistente } from "@/infra/almacen/configuracion";
import { validarImagen, TAMANO_MAXIMO_BYTES } from "@/infra/imagenes/validar";
import { procesarImagen } from "@/infra/imagenes/procesar";
import { agregarFoto, reordenarFotos, marcarSensible, definirPrincipal } from "@/domains/animales/fotos-servicio";
import type { ContextoFotos } from "@/domains/animales/tipos";

/** Arma el contexto de dominio para una transacción. Único punto de entrada del panel para fotos. */
async function conContextoFotos<T>(fn: (ctx: ContextoFotos) => Promise<T>): Promise<T> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  return prisma.$transaction(async (tx) =>
    fn({
      usuarioEmail: sesion.user.email!,
      rol: sesion.user.rol as ContextoFotos["rol"],
      repositorio: repositorioFotosPrisma(tx),
      auditoria: auditoriaPrisma(tx),
    })
  );
}

export async function accionSubirFoto(animalId: string, formulario: FormData) {
  const archivos = formulario.getAll("archivo").filter((valor): valor is File => valor instanceof File);
  const alt = String(formulario.get("alt") ?? "").trim();
  const sensible = formulario.get("sensible") === "on";

  if (archivos.length === 0) throw new Error("Falta el archivo");
  if (alt.length === 0) {
    throw new Error("Escribí una descripción de la foto: sin ella, quien no ve la imagen no sabe qué muestra");
  }
  if (archivos.some((archivo) => archivo.size > TAMANO_MAXIMO_BYTES)) {
    throw new Error("Una de las fotos pesa más de 12 MB. Sacale peso antes de subirla.");
  }

  exigirAlmacenPersistente();
  const deposito = almacen();

  for (const [indice, archivo] of archivos.entries()) {
    const datos = Buffer.from(await archivo.arrayBuffer());
    await validarImagen(datos); // por contenido real, no por extensión
    const procesada = await procesarImagen(datos);

    // El original no se guarda: solo las medidas en WebP que arma procesarImagen.
    const base = `animales/${animalId}/${randomUUID()}`;
    for (const medida of procesada.medidas) {
      await deposito.guardar(`${base}-${medida.ancho}.webp`, medida.datos, "image/webp");
    }

    // Con una sola foto el texto queda tal cual; con varias se numera para que cada una sea distinguible.
    const altDeEsta = archivos.length > 1 ? `${alt} (${indice + 1}/${archivos.length})` : alt;

    await conContextoFotos((ctx) =>
      agregarFoto(
        {
          animalId,
          claveArchivo: base,
          alt: altDeEsta,
          sensible,
          ancho: procesada.ancho,
          alto: procesada.alto,
          placeholder: procesada.placeholder,
        },
        ctx
      )
    );
  }

  revalidateTag("animales");
}

export async function accionReordenarFotos(animalId: string, idsEnOrden: string[]) {
  await conContextoFotos((ctx) => reordenarFotos(animalId, idsEnOrden, ctx));
  revalidateTag("animales");
}

export async function accionMarcarSensible(fotoId: string, sensible: boolean) {
  await conContextoFotos((ctx) => marcarSensible(fotoId, sensible, ctx));
  revalidateTag("animales");
}

export async function accionDefinirPrincipal(fotoId: string) {
  await conContextoFotos((ctx) => definirPrincipal(fotoId, ctx));
  revalidateTag("animales");
}
