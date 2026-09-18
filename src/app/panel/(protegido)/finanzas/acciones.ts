"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { auth } from "@/infra/auth";
import { prisma } from "@/infra/prisma";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { repositorioAvisosPrisma } from "@/infra/repositorios/avisos";
import { puertoAvisos } from "@/domains/avisos/cola";
import { almacen } from "@/infra/almacen";
import { exigirAlmacenPersistente } from "@/infra/almacen/configuracion";
import { crearCaso, editarCaso } from "@/domains/finanzas/casos";
import { registrarGasto } from "@/domains/finanzas/asientos";
import { registrarAjuste, trasladarEntreCasos } from "@/domains/finanzas/ajustes";
import { verificarTransferencia, rechazarTransferencia } from "@/domains/finanzas/donaciones";
import { subirDocumento } from "@/domains/finanzas/documentos";
import type { ContextoFinanzas } from "@/domains/finanzas/tipos";

/** Arma el contexto de dominio para una transacción. Único punto de entrada del panel de finanzas. */
async function conContextoFinanzas<T>(fn: (ctx: ContextoFinanzas) => Promise<T>): Promise<T> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  return prisma.$transaction(async (tx) =>
    fn({
      usuarioEmail: sesion.user.email!,
      rol: sesion.user.rol as ContextoFinanzas["rol"],
      repositorio: repositorioFinanzasPrisma(tx),
      auditoria: auditoriaPrisma(tx),
      avisos: puertoAvisos(repositorioAvisosPrisma(tx)),
    })
  );
}

/** Pesos con coma o punto decimal, tal como los escribe una persona en el formulario. */
function pesosACentavos(valor: FormDataEntryValue | null): bigint {
  const numero = Number(String(valor ?? "0").replace(",", "."));
  return BigInt(Math.round(numero * 100));
}

/**
 * Sube el comprobante al almacén y registra su metadato. Devuelve `null` si no
 * se adjuntó ningún archivo: el gasto puede quedar sin comprobante, el ajuste no.
 */
async function subirComprobanteSiHay(formulario: FormData, ctx: ContextoFinanzas): Promise<string | null> {
  const archivo = formulario.get("comprobante");
  if (!(archivo instanceof File) || archivo.size === 0) return null;

  exigirAlmacenPersistente();
  const datos = Buffer.from(await archivo.arrayBuffer());
  const claveArchivo = `comprobantes/${randomUUID()}-${archivo.name}`;
  await almacen().guardar(claveArchivo, datos, archivo.type || "application/octet-stream");

  const documento = await subirDocumento(
    {
      claveArchivo,
      nombre: archivo.name,
      tipo: archivo.type || "application/octet-stream",
      datosPersonalesTachados: formulario.get("datosPersonalesTachados") === "on",
    },
    ctx
  );
  return documento.id;
}

export async function accionCrearCaso(formulario: FormData) {
  const caso = await conContextoFinanzas((ctx) =>
    crearCaso(
      {
        titulo: String(formulario.get("titulo") ?? ""),
        situacion: String(formulario.get("situacion") ?? ""),
        metaCentavos: pesosACentavos(formulario.get("metaPesos")),
        animalId: (formulario.get("animalId") as string) || null,
      },
      ctx
    )
  );
  revalidateTag("casos");
  redirect(`/panel/finanzas/casos/${caso.id}`);
}

export async function accionEditarCaso(id: string, formulario: FormData) {
  await conContextoFinanzas((ctx) =>
    editarCaso(
      id,
      {
        titulo: String(formulario.get("titulo") ?? ""),
        situacion: String(formulario.get("situacion") ?? ""),
        metaCentavos: pesosACentavos(formulario.get("metaPesos")),
      },
      ctx
    )
  );
  revalidateTag("casos");
}

export async function accionRegistrarGasto(formulario: FormData) {
  await conContextoFinanzas(async (ctx) => {
    const documentoId = await subirComprobanteSiHay(formulario, ctx);
    return registrarGasto(
      {
        casoId: String(formulario.get("casoId") ?? ""),
        centavos: pesosACentavos(formulario.get("pesos")),
        descripcion: String(formulario.get("descripcion") ?? ""),
        documentoId,
        fechaEfectiva: new Date(String(formulario.get("fecha"))),
      },
      ctx
    );
  });
  // Sin esto el importe público queda viejo, que es justo donde la
  // transparencia se rompe.
  revalidateTag("casos");
}

export async function accionRegistrarAjuste(formulario: FormData) {
  await conContextoFinanzas(async (ctx) => {
    const documentoId = await subirComprobanteSiHay(formulario, ctx);
    if (!documentoId) throw new Error("Un ajuste necesita un comprobante de respaldo");

    return registrarAjuste(
      {
        casoId: String(formulario.get("casoId") ?? ""),
        centavos: pesosACentavos(formulario.get("pesos")),
        ajustaAId: String(formulario.get("ajustaAId") ?? ""),
        motivo: String(formulario.get("motivo") ?? ""),
        documentoId,
      },
      ctx
    );
  });
  revalidateTag("casos");
}

export async function accionTrasladar(formulario: FormData) {
  await conContextoFinanzas((ctx) =>
    trasladarEntreCasos(
      {
        origenId: String(formulario.get("origenId") ?? ""),
        destinoId: String(formulario.get("destinoId") ?? ""),
        centavos: pesosACentavos(formulario.get("pesos")),
        motivo: String(formulario.get("motivo") ?? ""),
      },
      ctx
    )
  );
  revalidateTag("casos");
}

export async function accionVerificarTransferencia(intencionId: string) {
  await conContextoFinanzas((ctx) => verificarTransferencia(intencionId, ctx));
  revalidateTag("casos");
}

export async function accionRechazarTransferencia(intencionId: string, motivo: string) {
  await conContextoFinanzas((ctx) => rechazarTransferencia(intencionId, motivo, ctx));
  revalidateTag("casos");
}
