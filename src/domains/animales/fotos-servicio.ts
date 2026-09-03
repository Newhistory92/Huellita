import { puede } from "@/domains/usuarios/autorizacion";
import { ordenarTrasReordenar, elegirPrincipal } from "./fotos";
import type { ContextoFotos, Foto, NuevaFoto } from "./tipos";

function exigirPermisoSobreFotos(ctx: ContextoFotos): void {
  if (!puede(ctx.rol, "animales.escribir")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para gestionar fotos`);
  }
}

function exigirLecturaDeFotos(ctx: ContextoFotos): void {
  if (!puede(ctx.rol, "animales.leer")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para ver fotos`);
  }
}

export async function listarFotos(animalId: string, ctx: ContextoFotos): Promise<Foto[]> {
  exigirLecturaDeFotos(ctx);
  return ctx.repositorio.listarPorAnimal(animalId);
}

export async function agregarFoto(datos: NuevaFoto, ctx: ContextoFotos): Promise<Foto> {
  exigirPermisoSobreFotos(ctx);

  const existentes = await ctx.repositorio.listarPorAnimal(datos.animalId);
  const foto = await ctx.repositorio.crear({
    ...datos,
    orden: existentes.length,
    principal: existentes.length === 0,
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "foto.agregar",
    entidad: "FotoAnimal",
    entidadId: foto.id,
    valorNuevo: foto,
  });
  return foto;
}

export async function reordenarFotos(animalId: string, idsEnOrden: string[], ctx: ContextoFotos): Promise<void> {
  exigirPermisoSobreFotos(ctx);

  const fotos = await ctx.repositorio.listarPorAnimal(animalId);
  const nuevoOrden = ordenarTrasReordenar(fotos, idsEnOrden);
  await ctx.repositorio.reordenar(nuevoOrden);

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "foto.reordenar",
    entidad: "Animal",
    entidadId: animalId,
    valorNuevo: nuevoOrden,
  });
}

export async function marcarSensible(fotoId: string, sensible: boolean, ctx: ContextoFotos): Promise<Foto> {
  exigirPermisoSobreFotos(ctx);

  const foto = await ctx.repositorio.actualizar(fotoId, { sensible });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "foto.marcarSensible",
    entidad: "FotoAnimal",
    entidadId: fotoId,
    valorNuevo: { sensible },
  });
  return foto;
}

export async function definirPrincipal(fotoId: string, ctx: ContextoFotos): Promise<Foto> {
  exigirPermisoSobreFotos(ctx);

  const foto = await ctx.repositorio.porId(fotoId);
  if (!foto) throw new Error("No existe la foto");

  const fotos = await ctx.repositorio.listarPorAnimal(foto.animalId);
  const conNuevaPrincipal = elegirPrincipal(fotos, fotoId);

  for (const f of conNuevaPrincipal) {
    const original = fotos.find((x) => x.id === f.id)!;
    if (original.principal !== f.principal) {
      await ctx.repositorio.actualizar(f.id, { principal: f.principal });
    }
  }

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "foto.definirPrincipal",
    entidad: "FotoAnimal",
    entidadId: fotoId,
  });
  return (await ctx.repositorio.porId(fotoId))!;
}
