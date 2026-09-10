import { exigirPermisoSobrePostulaciones } from "./preguntas";
import type { ContextoPostulaciones, EstadoPostulacion, Postulacion } from "./tipos";

async function exigirPostulacionEditable(id: string, ctx: ContextoPostulaciones): Promise<Postulacion> {
  const postulacion = await ctx.repositorio.postulacionPorId(id);
  if (!postulacion) throw new Error("No existe la postulación");
  if (postulacion.anonimizadaEn) {
    // Sin contacto no hay nada que gestionar. Dejarla editable invitaría a
    // moverla de estado como si todavía hubiera una persona del otro lado.
    throw new Error("La postulación está anonimizada: queda de solo lectura");
  }
  return postulacion;
}

/**
 * Cambia el estado y guarda el comentario en la bitácora, que es el historial
 * de la postulación. No hay tabla de notas: el historial es la secuencia de
 * acciones administrativas, y eso ya vive en la auditoría.
 *
 * No toca al animal. Que una postulación se apruebe no significa que la
 * adopción se haya concretado, y un animal que figura como adoptado sin
 * estarlo es un error que se ve en público.
 */
export async function cambiarEstado(
  id: string,
  estado: EstadoPostulacion,
  comentario: string | null,
  ctx: ContextoPostulaciones
): Promise<Postulacion> {
  exigirPermisoSobrePostulaciones(ctx);
  const anterior = await exigirPostulacionEditable(id, ctx);

  const actualizada = await ctx.repositorio.actualizarPostulacion(id, { estado });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "postulacion.cambiarEstado",
    entidad: "Postulacion",
    entidadId: id,
    valorAnterior: { estado: anterior.estado },
    valorNuevo: comentario ? { estado, comentario } : { estado },
  });

  return actualizada;
}

/**
 * Borra los datos de contacto y el contenido de las respuestas, a pedido de la
 * persona. Conserva el caparazón —a qué animal, cuándo, en qué estado
 * terminó— como estadística anónima, y el texto de las preguntas, que no es
 * dato personal.
 */
export async function borrarDatosPersonales(id: string, ctx: ContextoPostulaciones): Promise<Postulacion> {
  exigirPermisoSobrePostulaciones(ctx);

  const postulacion = await ctx.repositorio.postulacionPorId(id);
  if (!postulacion) throw new Error("No existe la postulación");
  if (postulacion.anonimizadaEn) throw new Error("Los datos personales de esta postulación ya se habían borrado");

  await ctx.repositorio.vaciarRespuestas(id);
  const anonimizada = await ctx.repositorio.actualizarPostulacion(id, {
    nombre: "",
    email: "",
    telefono: "",
    anonimizadaEn: new Date(),
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "postulacion.borrarDatosPersonales",
    entidad: "Postulacion",
    entidadId: id,
    valorNuevo: { animalId: postulacion.animalId, estado: postulacion.estado },
  });

  return anonimizada;
}

/**
 * Rechaza las demás postulaciones de un animal. Se ofrece al concretar una
 * adopción: si no, quedan en estado "nueva" para siempre y la bandeja deja de
 * servir para saber qué falta atender.
 *
 * Devuelve cuántas cerró.
 */
export async function cerrarOtrasPostulaciones(
  animalId: string,
  exceptoId: string,
  ctx: ContextoPostulaciones
): Promise<number> {
  exigirPermisoSobrePostulaciones(ctx);

  const todas = await ctx.repositorio.listarPostulaciones({ animalId });
  const abiertas = todas.filter(
    (p) => p.id !== exceptoId && p.anonimizadaEn === null && p.estado !== "RECHAZADA" && p.estado !== "ADOPCION_CONCRETADA"
  );

  for (const postulacion of abiertas) {
    await ctx.repositorio.actualizarPostulacion(postulacion.id, { estado: "RECHAZADA" });
    await ctx.auditoria.registrar({
      usuarioEmail: ctx.usuarioEmail,
      accion: "postulacion.cambiarEstado",
      entidad: "Postulacion",
      entidadId: postulacion.id,
      valorAnterior: { estado: postulacion.estado },
      valorNuevo: { estado: "RECHAZADA", comentario: "Cerrada al concretarse la adopción con otra postulación" },
    });
  }

  return abiertas.length;
}
