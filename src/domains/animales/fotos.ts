interface FotoOrdenable { id: string; orden: number; principal: boolean }

export function ordenarTrasReordenar(
  fotos: FotoOrdenable[],
  idsEnOrden: string[]
): Array<{ id: string; orden: number }> {
  const existentes = new Set(fotos.map((f) => f.id));
  const recibidos = new Set(idsEnOrden);
  if (existentes.size !== recibidos.size || [...existentes].some((id) => !recibidos.has(id))) {
    throw new Error("El nuevo orden tiene que incluir todas las fotos, exactamente una vez");
  }
  return idsEnOrden.map((id, orden) => ({ id, orden }));
}

export function elegirPrincipal(fotos: FotoOrdenable[], idPrincipal: string | null): FotoOrdenable[] {
  const objetivo = idPrincipal ?? fotos[0]?.id;
  return fotos.map((f) => ({ ...f, principal: f.id === objetivo }));
}

/**
 * El original no se sirve nunca: la clave apunta a una de las medidas que
 * generó el pipeline de imágenes.
 *
 * El pipeline nunca agranda una imagen: recorta cada medida al ancho real del
 * original. Una foto de 768px de ancho guarda su medida de 1024 con el nombre
 * -768. Por eso acá se aplica el mismo recorte: pedir una medida que el
 * pipeline no generó devuelve 404 y la foto aparece rota.
 */
export function urlDeFoto(foto: { claveArchivo: string; ancho: number }, anchoDeseado: number): string {
  const anchoDisponible = Math.min(anchoDeseado, foto.ancho);
  return `/archivos/${foto.claveArchivo}-${anchoDisponible}.webp`;
}
