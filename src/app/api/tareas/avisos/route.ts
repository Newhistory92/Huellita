import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { vaciarCola } from "@/domains/avisos/cola";
import { repositorioAvisosPrisma } from "@/infra/repositorios/avisos";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { correo } from "@/infra/correo";

export const runtime = "nodejs";

function secretoValido(recibido: string | null): boolean {
  const esperado = process.env.TAREAS_SECRETO ?? "";
  if (!esperado || !recibido) return false;

  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(recibido, "utf8");
  if (a.length !== b.length) return false;
  // Comparación de tiempo constante, igual que la firma del webhook.
  return timingSafeEqual(a, b);
}

export async function POST(pedido: Request) {
  if (!secretoValido(pedido.headers.get("x-tareas-secreto"))) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const urlBase = process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000";
  const resumen = await vaciarCola(
    { repositorio: repositorioAvisosPrisma(), correo: correo(), auditoria: auditoriaPrisma() },
    urlBase
  );

  return NextResponse.json(resumen);
}
