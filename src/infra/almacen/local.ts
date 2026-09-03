import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { AlmacenDeArchivos } from "./tipos";

/**
 * Implementación para desarrollo. En producción se reemplaza por una
 * S3-compatible sin tocar nada fuera de este directorio: la base guarda la
 * clave del archivo, nunca la URL completa.
 */
export function almacenLocal(directorio = process.env.ALMACEN_DIRECTORIO_LOCAL ?? "./almacenamiento"): AlmacenDeArchivos {
  return {
    async guardar(clave, datos) {
      const destino = path.join(directorio, clave);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, datos);
    },
    url(clave) {
      return `/archivos/${clave}`;
    },
    async borrar(clave) {
      await unlink(path.join(directorio, clave)).catch(() => {});
    },
  };
}
