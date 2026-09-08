import { NextResponse, type NextRequest } from "next/server";
import { documentoPublico } from "@/domains/finanzas/consultas";
import { obtenerDocumento } from "@/domains/finanzas/documentos";
import { contextoFinanzas } from "@/infra/contexto-finanzas";
import { almacen } from "@/infra/almacen";

/**
 * Público si el documento está marcado como tal. Si no, solo lo sirve a una
 * sesión del panel: así quien verifica una transferencia puede ver el
 * comprobante antes de que alguien confirme el tachado de datos personales.
 */
export async function GET(_solicitud: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const publico = await documentoPublico(id);
  if (publico) return NextResponse.redirect(almacen().url(publico.claveArchivo));

  const ctx = await contextoFinanzas().catch(() => null);
  if (ctx) {
    const privado = await obtenerDocumento(id, ctx).catch(() => null);
    if (privado) return NextResponse.redirect(almacen().url(privado.claveArchivo));
  }

  return new NextResponse("No encontrado", { status: 404 });
}
