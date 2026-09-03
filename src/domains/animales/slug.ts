/**
 * La dirección de un animal es permanente: se genera una sola vez, al crearlo,
 * y no cambia aunque después se corrija el nombre. Los enlaces que circularon
 * por Facebook tienen que seguir funcionando para siempre.
 */
export function generarSlug(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpio.length > 0 ? limpio : "animal";
}

export function slugDisponible(base: string, existentes: string[]): string {
  if (!existentes.includes(base)) return base;
  let n = 2;
  while (existentes.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
