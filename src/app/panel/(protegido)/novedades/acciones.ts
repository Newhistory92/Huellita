"use server";

import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { auth } from "@/infra/auth";
import { prisma } from "@/infra/prisma";
import { repositorioNovedadesPrisma } from "@/infra/repositorios/novedades";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearNovedad, editarNovedad, archivarNovedad } from "@/domains/novedades/servicio";
import { almacen } from "@/infra/almacen";
import { exigirAlmacenPersistente } from "@/infra/almacen/configuracion";
import { validarImagen, TAMANO_MAXIMO_BYTES } from "@/infra/imagenes/validar";
import { procesarImagen } from "@/infra/imagenes/procesar";
import type { ContextoNovedades, Foto } from "@/domains/novedades/tipos";

async function conContextoNovedades<T>(fn: (ctx: ContextoNovedades) => Promise<T>): Promise<T> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  return prisma.$transaction(async (tx) =>
    fn({
      usuarioEmail: sesion.user.email!,
      rol: sesion.user.rol as ContextoNovedades["rol"],
      repositorio: repositorioNovedadesPrisma(tx),
      auditoria: auditoriaPrisma(tx),
    })
  );
}

/**
 * La imagen se procesa y se guarda ANTES de abrir la transacción: convertir y
 * subir tarda, y mantener una transacción de base abierta mientras tanto
 * bloquea filas sin necesidad.
 */
async function subirFotoSiHay(formulario: FormData): Promise<Foto | null> {
  const archivo = formulario.get("foto");
  if (!(archivo instanceof File) || archivo.size === 0) return null;

  const alt = String(formulario.get("fotoAlt") ?? "").trim();
  if (alt.length === 0) {
    throw new Error("Escribí una descripción de la foto: sin ella, quien no ve la imagen no sabe qué muestra");
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    throw new Error("La foto pesa más de 12 MB. Sacale peso antes de subirla.");
  }

  exigirAlmacenPersistente();
  const datos = Buffer.from(await archivo.arrayBuffer());
  await validarImagen(datos);
  const procesada = await procesarImagen(datos);

  const deposito = almacen();
  const clave = `novedades/${randomUUID()}`;
  for (const medida of procesada.medidas) {
    await deposito.guardar(`${clave}-${medida.ancho}.webp`, medida.datos, "image/webp");
  }

  return { clave, alt, ancho: procesada.ancho, alto: procesada.alto, placeholder: procesada.placeholder };
}

export async function accionCrearNovedad(formulario: FormData) {
  const foto = await subirFotoSiHay(formulario);

  await conContextoNovedades((ctx) =>
    crearNovedad(
      {
        casoId: (formulario.get("casoId") as string) || null,
        animalId: (formulario.get("animalId") as string) || null,
        titulo: String(formulario.get("titulo") ?? ""),
        cuerpo: String(formulario.get("cuerpo") ?? ""),
        foto,
        documentoId: (formulario.get("documentoId") as string) || null,
      },
      ctx
    )
  );

  revalidateTag("novedades");
}

export async function accionEditarNovedad(id: string, formulario: FormData) {
  await conContextoNovedades((ctx) =>
    editarNovedad(
      id,
      { titulo: String(formulario.get("titulo") ?? ""), cuerpo: String(formulario.get("cuerpo") ?? "") },
      ctx
    )
  );
  revalidateTag("novedades");
}

export async function accionArchivarNovedad(id: string) {
  await conContextoNovedades((ctx) => archivarNovedad(id, ctx));
  revalidateTag("novedades");
}
