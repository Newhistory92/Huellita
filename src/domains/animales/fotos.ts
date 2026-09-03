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
