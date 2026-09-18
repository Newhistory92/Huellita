import { NextResponse } from "next/server";
import { prisma } from "@/infra/prisma";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { repositorioAvisosPrisma } from "@/infra/repositorios/avisos";
import { puertoAvisos } from "@/domains/avisos/cola";
import { mercadoPago } from "@/infra/pagos/mercadopago";
import { firmaValida } from "@/infra/pagos/firma";
import { procesarAviso } from "@/domains/pagos/procesar-aviso";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";

export async function POST(pedido: Request) {
  const cuerpo = await pedido.json().catch(() => null);
  const idDelRecurso = String(cuerpo?.data?.id ?? "");
  if (!idDelRecurso) return NextResponse.json({ error: "aviso sin recurso" }, { status: 400 });

  if (
    !firmaValida({
      cabeceraFirma: pedido.headers.get("x-signature"),
      cabeceraPedido: pedido.headers.get("x-request-id"),
      idDelRecurso,
      secreto: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
    })
  ) {
    // No vino de Mercado Pago: no se registra ni se procesa.
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  // Segunda barrera de idempotencia: contra el aviso repetido. La clave
  // incluye la acción porque un mismo pago genera avisos legítimos distintos
  // cuando cambia de estado.
  const claveDelAviso = `${cuerpo.type ?? "payment"}:${idDelRecurso}:${cuerpo.action ?? ""}`;
  try {
    await prisma.eventoWebhook.create({
      data: { proveedor: "mercadopago", eventoExternoId: claveDelAviso, cargaUtil: cuerpo },
    });
  } catch {
    // Ya lo habíamos recibido: que deje de reintentar.
    return NextResponse.json({ ok: true, nota: "aviso repetido" });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) =>
      procesarAviso(
        { pagoExternoId: idDelRecurso },
        {
          repositorio: repositorioFinanzasPrisma(tx),
          auditoria: auditoriaPrisma(tx),
          proveedor: mercadoPago(),
          avisos: puertoAvisos(repositorioAvisosPrisma(tx)),
        }
      )
    );

    await prisma.eventoWebhook.updateMany({
      where: { proveedor: "mercadopago", eventoExternoId: claveDelAviso },
      data: { procesadoEn: new Date(), resultado: resultado.tipo },
    });

    if (resultado.tipo === "asentado") revalidateTag("casos");

    // Que reintente solo cuando reintentar puede cambiar algo.
    if (resultado.tipo === "reintentar") {
      return NextResponse.json({ error: resultado.razon }, { status: 500 });
    }
    return NextResponse.json({ ok: true, resultado: resultado.tipo });
  } catch (error) {
    // Falla nuestra: que Mercado Pago reintente.
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
