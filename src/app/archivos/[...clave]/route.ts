import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const DIRECTORIO = process.env.ALMACEN_DIRECTORIO_LOCAL ?? "./almacenamiento";

const TIPOS_POR_EXTENSION: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/** Sirve los archivos del almacén local en desarrollo; en producción los sirve el proveedor S3-compatible directamente. */
export async function GET(_req: Request, { params }: { params: Promise<{ clave: string[] }> }) {
  const { clave } = await params;
  const base = path.resolve(DIRECTORIO);
  const destino = path.resolve(base, ...clave);

  // La clave viaja en la URL: hay que evitar que "../" escape del directorio del almacén.
  if (!destino.startsWith(base + path.sep) && destino !== base) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  try {
    const datos = await readFile(destino);
    const tipo = TIPOS_POR_EXTENSION[path.extname(destino).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(datos, {
      headers: {
        "Content-Type": tipo,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}
