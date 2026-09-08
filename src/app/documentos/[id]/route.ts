import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/infra/auth";
import { documentoPublico } from "@/domains/finanzas/consultas";
import { obtenerDocumento } from "@/domains/finanzas/documentos";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { almacen } from "@/infra/almacen";
import type { ContextoFinanzas } from "@/domains/finanzas/tipos";

/**
 * Público si el documento está marcado como tal. Si no, solo lo sirve a una
 * sesión del panel: así quien verifica una transferencia puede ver el
 * comprobante antes de que alguien confirme el tachado de datos personales.
 */
export async function GET(_solicitud: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const publico = await documentoPublico(id);
  if (publico) return NextResponse.redirect(almacen().url(publico.claveArchivo));

  const sesion = await auth();
  if (sesion?.user?.email && sesion.user.rol) {
    const ctx: ContextoFinanzas = {
      usuarioEmail: sesion.user.email,
      rol: sesion.user.rol as ContextoFinanzas["rol"],
      repositorio: repositorioFinanzasPrisma(),
      auditoria: auditoriaPrisma(),
    };
    const privado = await obtenerDocumento(id, ctx).catch(() => null);
    if (privado) return NextResponse.redirect(almacen().url(privado.claveArchivo));
  }

  return new NextResponse("No encontrado", { status: 404 });
}
