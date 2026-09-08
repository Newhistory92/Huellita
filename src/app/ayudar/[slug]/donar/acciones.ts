"use server";

import { redirect } from "next/navigation";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { mercadoPago } from "@/infra/pagos/mercadopago";

export async function accionIniciarDonacion(formulario: FormData) {
  const repositorio = repositorioFinanzasPrisma();
  const slug = String(formulario.get("slug") ?? "");
  const caso = await repositorio.casoPorSlug(slug);
  if (!caso) throw new Error("No existe el caso");

  const pesos = Number(formulario.get("pesos") ?? 0);
  if (!Number.isFinite(pesos) || pesos < 100) {
    throw new Error("El importe mínimo es de $100");
  }

  const nombre = String(formulario.get("nombre") ?? "").trim();
  const intencion = await repositorio.crearIntencion({
    casoId: caso.id,
    centavos: BigInt(Math.round(pesos * 100)),
    moneda: caso.moneda,
    nombreDonante: nombre.length > 0 ? nombre : null,
    // Publicar el nombre es una decisión activa: si no marcó la casilla, no.
    publicarNombre: formulario.get("publicarNombre") === "on",
    mensaje: String(formulario.get("mensaje") ?? "").trim() || null,
    proveedor: "mercadopago",
    estado: "INICIADA",
    referenciaExterna: null,
    pagoExternoId: null,
    comprobanteId: null,
  });

  const base = process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000";
  const preferencia = await mercadoPago().crearPreferencia({
    intencionId: intencion.id,
    titulo: caso.titulo,
    centavos: intencion.centavos,
    moneda: caso.moneda,
    urlRetorno: `${base}/ayudar/${caso.slug}/gracias`,
    urlAviso: `${base}/api/webhooks/mercadopago`,
  });

  await repositorio.actualizarIntencion(intencion.id, { referenciaExterna: preferencia.referenciaExterna });
  redirect(preferencia.urlDePago);
}
