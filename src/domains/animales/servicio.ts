import { esquemaAnimal, type EntradaAnimal } from "./esquemas";
import { generarSlug, slugDisponible } from "./slug";
import type { Animal, Contexto } from "./tipos";

const ROLES_QUE_GESTIONAN_ANIMALES = ["ADMINISTRACION", "ANIMALES"];

/** El permiso se verifica acá, no en la pantalla: esconder un botón no es seguridad. */
function exigirPermisoSobreAnimales(ctx: Contexto): void {
  if (!ROLES_QUE_GESTIONAN_ANIMALES.includes(ctx.rol)) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para gestionar animales`);
  }
}

export async function crearAnimal(entrada: EntradaAnimal, ctx: Contexto): Promise<Animal> {
  exigirPermisoSobreAnimales(ctx);

  const datos = esquemaAnimal.parse(entrada);
  const existentes = await ctx.repositorio.slugsExistentes();
  const slug = slugDisponible(generarSlug(datos.nombre), existentes);

  const animal = await ctx.repositorio.crear({
    ...datos,
    slug,
    estado: "BORRADOR",
    archivado: false,
    publicadoEn: null,
    atributos: datos.atributos,
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "animal.crear",
    entidad: "Animal",
    entidadId: animal.id,
    valorNuevo: animal,
  });

  return animal;
}
