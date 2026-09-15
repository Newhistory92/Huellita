import { puede } from "@/domains/usuarios/autorizacion";
import type { ContextoPostulaciones, Pregunta, TipoRespuesta } from "./tipos";

/** Identificador del formulario base. Hay uno solo. */
export const FORMULARIO_BASE = "formulario-base";

const TIPOS_CON_OPCIONES: TipoRespuesta[] = ["OPCION_MULTIPLE", "SELECCION_MULTIPLE"];

export function exigirPermisoSobrePostulaciones(ctx: ContextoPostulaciones): void {
  if (!puede(ctx.rol, "postulaciones.escribir")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para gestionar postulaciones`);
  }
}

/** El rol de Finanzas no tiene ningún acceso a postulaciones, ni de lectura. Ver §7 de la entrega 1. */
export function exigirLecturaDePostulaciones(ctx: ContextoPostulaciones): void {
  if (!puede(ctx.rol, "postulaciones.leer")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para ver las postulaciones`);
  }
}

export interface EntradaPregunta {
  texto: string;
  tipo: TipoRespuesta;
  ayuda?: string | null;
  opciones?: string[];
  obligatoria?: boolean;
  /** Si viene, la pregunta es propia de ese animal en vez del formulario base. */
  animalId?: string | null;
}

function validarOpciones(tipo: TipoRespuesta, opciones: string[]): void {
  const llevaOpciones = TIPOS_CON_OPCIONES.includes(tipo);
  if (llevaOpciones && opciones.length < 2) {
    throw new Error("Una pregunta de opciones necesita al menos dos opciones");
  }
  if (!llevaOpciones && opciones.length > 0) {
    throw new Error(`Una pregunta de tipo ${tipo} no lleva opciones`);
  }
}

export async function crearPregunta(entrada: EntradaPregunta, ctx: ContextoPostulaciones): Promise<Pregunta> {
  exigirPermisoSobrePostulaciones(ctx);

  const texto = entrada.texto.trim();
  if (texto.length === 0) throw new Error("La pregunta necesita un texto");

  const opciones = entrada.opciones ?? [];
  validarOpciones(entrada.tipo, opciones);

  const animalId = entrada.animalId ?? null;
  const hermanas = animalId
    ? await ctx.repositorio.preguntasDelAnimal(animalId)
    : await ctx.repositorio.preguntasDelFormulario();

  const pregunta = await ctx.repositorio.crearPregunta({
    formularioId: animalId ? null : FORMULARIO_BASE,
    animalId,
    texto,
    ayuda: entrada.ayuda ?? null,
    tipo: entrada.tipo,
    opciones,
    obligatoria: entrada.obligatoria ?? false,
    // Al final: reordenar es una acción aparte.
    orden: hermanas.length,
    archivada: false,
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "pregunta.crear",
    entidad: "PreguntaFormulario",
    entidadId: pregunta.id,
    valorNuevo: { texto: pregunta.texto, tipo: pregunta.tipo, animalId },
  });
  return pregunta;
}

/**
 * El tipo no se puede cambiar. Una pregunta de sí/no que pasa a texto largo
 * deja veinte respuestas que dicen "sí" contestando algo que ya no es una
 * pregunta de sí o no. Si hace falta otro tipo, se archiva y se crea otra.
 */
const CAMPOS_PROHIBIDOS = ["id", "tipo", "formularioId", "animalId", "orden"] as const;

export async function editarPregunta(
  id: string,
  cambios: Partial<Pregunta>,
  ctx: ContextoPostulaciones
): Promise<Pregunta> {
  exigirPermisoSobrePostulaciones(ctx);

  const anterior = await ctx.repositorio.preguntaPorId(id);
  if (!anterior) throw new Error("No existe la pregunta");

  if (cambios.tipo !== undefined && cambios.tipo !== anterior.tipo) {
    throw new Error(
      "No se puede cambiar el tipo de una pregunta: las respuestas ya dadas quedarían sin sentido. Archivala y creá otra."
    );
  }

  const seguros = { ...cambios };
  for (const campo of CAMPOS_PROHIBIDOS) delete seguros[campo];
  if (seguros.opciones) validarOpciones(anterior.tipo, seguros.opciones);

  const editada = await ctx.repositorio.actualizarPregunta(id, seguros);
  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "pregunta.editar",
    entidad: "PreguntaFormulario",
    entidadId: id,
    valorAnterior: { texto: anterior.texto, obligatoria: anterior.obligatoria },
    valorNuevo: { texto: editada.texto, obligatoria: editada.obligatoria },
  });
  return editada;
}

export async function archivarPregunta(id: string, ctx: ContextoPostulaciones): Promise<Pregunta> {
  exigirPermisoSobrePostulaciones(ctx);
  const anterior = await ctx.repositorio.preguntaPorId(id);
  if (!anterior) throw new Error("No existe la pregunta");

  const archivada = await ctx.repositorio.actualizarPregunta(id, { archivada: true });
  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "pregunta.archivar",
    entidad: "PreguntaFormulario",
    entidadId: id,
    valorAnterior: { archivada: false },
    valorNuevo: { archivada: true },
  });
  return archivada;
}

export async function reordenarPreguntas(idsEnOrden: string[], ctx: ContextoPostulaciones): Promise<void> {
  exigirPermisoSobrePostulaciones(ctx);

  const primera = await ctx.repositorio.preguntaPorId(idsEnOrden[0] ?? "");
  if (!primera) throw new Error("No existe la pregunta");

  const hermanas = primera.animalId
    ? await ctx.repositorio.preguntasDelAnimal(primera.animalId)
    : await ctx.repositorio.preguntasDelFormulario();

  const existentes = new Set(hermanas.map((p) => p.id));
  const recibidos = new Set(idsEnOrden);
  if (existentes.size !== recibidos.size || [...existentes].some((id) => !recibidos.has(id))) {
    throw new Error("El nuevo orden tiene que incluir todas las preguntas, exactamente una vez");
  }

  for (const [orden, id] of idsEnOrden.entries()) {
    await ctx.repositorio.actualizarPregunta(id, { orden });
  }

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "pregunta.reordenar",
    entidad: "PreguntaFormulario",
    entidadId: primera.animalId ?? FORMULARIO_BASE,
    valorNuevo: { orden: idsEnOrden },
  });
}
