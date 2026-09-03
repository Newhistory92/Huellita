import { esquemaAnimal, type EntradaAnimal } from "./esquemas";
import { generarSlug, slugDisponible } from "./slug";
import type { Animal, Contexto, EstadoAnimal, FiltroAnimales } from "./tipos";
import { puede } from "@/domains/usuarios/autorizacion";

/** El permiso se verifica acá, no en la pantalla: esconder un botón no es seguridad. */
function exigirPermisoSobreAnimales(ctx: Contexto): void {
  if (!puede(ctx.rol, "animales.escribir")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para gestionar animales`);
  }
}

function exigirLecturaDeAnimales(ctx: Contexto): void {
  if (!puede(ctx.rol, "animales.leer")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para ver animales`);
  }
}

export async function listarAnimales(filtro: FiltroAnimales, ctx: Contexto): Promise<Animal[]> {
  exigirLecturaDeAnimales(ctx);
  return ctx.repositorio.listar(filtro);
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

async function exigirAnimal(id: string, ctx: Contexto): Promise<Animal> {
  const animal = await ctx.repositorio.porId(id);
  if (!animal) throw new Error("No existe el animal");
  return animal;
}

export async function obtenerAnimal(id: string, ctx: Contexto): Promise<Animal> {
  exigirLecturaDeAnimales(ctx);
  return exigirAnimal(id, ctx);
}

export async function publicarAnimal(id: string, ctx: Contexto): Promise<Animal> {
  exigirPermisoSobreAnimales(ctx);
  const animal = await exigirAnimal(id, ctx);

  // Publicar exige la misma calidad mínima que crear: una ficha a medio
  // escribir es un enlace que va a circular por Facebook durante años.
  esquemaAnimal.parse(animal);

  const publicado = await ctx.repositorio.actualizar(id, {
    estado: "DISPONIBLE",
    publicadoEn: animal.publicadoEn ?? new Date(),
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "animal.publicar",
    entidad: "Animal",
    entidadId: id,
    valorAnterior: { estado: animal.estado },
    valorNuevo: { estado: publicado.estado },
  });
  return publicado;
}

export async function editarAnimal(
  id: string,
  cambios: Partial<Omit<Animal, "id" | "slug">>,
  ctx: Contexto
): Promise<Animal> {
  exigirPermisoSobreAnimales(ctx);
  const anterior = await exigirAnimal(id, ctx);

  // El slug se ignora de forma explícita: la dirección es permanente.
  const { slug: _descartado, ...seguros } = cambios as Partial<Animal>;
  const editado = await ctx.repositorio.actualizar(id, seguros);

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "animal.editar",
    entidad: "Animal",
    entidadId: id,
    valorAnterior: anterior,
    valorNuevo: editado,
  });
  return editado;
}

export async function cambiarEstado(id: string, estado: EstadoAnimal, ctx: Contexto): Promise<Animal> {
  exigirPermisoSobreAnimales(ctx);
  const anterior = await exigirAnimal(id, ctx);
  const nuevo = await ctx.repositorio.actualizar(id, { estado });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "animal.cambiarEstado",
    entidad: "Animal",
    entidadId: id,
    valorAnterior: { estado: anterior.estado },
    valorNuevo: { estado: nuevo.estado },
  });
  return nuevo;
}

/** Archivar saca al animal de los listados, pero su ficha sigue en línea. */
export async function archivarAnimal(id: string, ctx: Contexto): Promise<Animal> {
  exigirPermisoSobreAnimales(ctx);
  const anterior = await exigirAnimal(id, ctx);
  const archivado = await ctx.repositorio.actualizar(id, { archivado: true });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "animal.archivar",
    entidad: "Animal",
    entidadId: id,
    valorAnterior: { archivado: anterior.archivado },
    valorNuevo: { archivado: true },
  });
  return archivado;
}
