import { unstable_cache } from "next/cache";
import { prisma } from "@/infra/prisma";
import { paraCache, desdeCache } from "@/domains/finanzas/consultas";
import { repositorioPostulacionesPrisma } from "@/infra/repositorios/postulaciones";
import { armarFormulario } from "./formulario";
import { exigirLecturaDePostulaciones } from "./preguntas";
import type {
  ContextoPostulaciones,
  EstadoPostulacion,
  FiltroPostulaciones,
  Postulacion,
  Pregunta,
  Respuesta,
} from "./tipos";

/** Quita acentos y mayúsculas para comparar como compara una persona. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Filtra por lo que la gente respondió. Es la razón por la que las respuestas
 * son filas: con veinte postulaciones para un animal, poder ver solo las que
 * tienen patio cerrado cambia el trabajo de quien revisa.
 */
export function filtrarPorRespuesta(
  postulaciones: Postulacion[],
  respuestasPorPostulacion: Map<string, Respuesta[]>,
  busqueda: string
): Postulacion[] {
  const termino = normalizar(busqueda.trim());
  if (termino.length === 0) return postulaciones;

  return postulaciones.filter((postulacion) => {
    const respuestas = respuestasPorPostulacion.get(postulacion.id) ?? [];
    return respuestas.some(
      (r) => normalizar(r.valor).includes(termino) || normalizar(r.textoPregunta).includes(termino)
    );
  });
}

/**
 * El formulario que ve una persona. Se cachea porque lo pide cada visita a la
 * página de postulación, y cambia solo cuando la asociación edita preguntas.
 *
 * paraCache y desdeCache son obligatorios: unstable_cache guarda con
 * JSON.stringify a secas y devuelve texto donde había fechas.
 */
export const preguntasDelFormularioDe = unstable_cache(
  async (animalId: string) => paraCache(await armarFormulario(animalId, repositorioPostulacionesPrisma())),
  ["preguntas-del-formulario"],
  { tags: ["formulario"] }
) as unknown as (animalId: string) => Promise<Pregunta[]>;

/**
 * El listado del panel no se cachea: la bandeja tiene que mostrar lo que llegó
 * hace un minuto, y cachearla sería mostrar una bandeja vieja.
 *
 * El permiso se verifica acá, no en la pantalla: el rol de Finanzas no tiene
 * ningún acceso a postulaciones, ni de lectura.
 */
export async function postulacionesDelPanel(
  filtro: FiltroPostulaciones,
  ctx: ContextoPostulaciones
): Promise<Postulacion[]> {
  exigirLecturaDePostulaciones(ctx);
  return repositorioPostulacionesPrisma().listarPostulaciones(filtro);
}

/**
 * Todas las preguntas del formulario base para el panel: activas y
 * archivadas. A diferencia de `preguntasDelFormularioDe`, no oculta las
 * archivadas (quien administra el formulario necesita verlas) y no se
 * cachea, para que un alta o una edición se vean de inmediato.
 */
export async function preguntasDelFormularioPanel(ctx: ContextoPostulaciones): Promise<Pregunta[]> {
  exigirLecturaDePostulaciones(ctx);
  return repositorioPostulacionesPrisma().preguntasDelFormulario();
}

/** Igual que `preguntasDelFormularioPanel`, pero las preguntas propias de un animal. */
export async function preguntasDelAnimalPanel(animalId: string, ctx: ContextoPostulaciones): Promise<Pregunta[]> {
  exigirLecturaDePostulaciones(ctx);
  return repositorioPostulacionesPrisma().preguntasDelAnimal(animalId);
}

export async function detalleDePostulacion(
  id: string,
  ctx: ContextoPostulaciones
): Promise<{ postulacion: Postulacion; respuestas: Respuesta[] } | null> {
  exigirLecturaDePostulaciones(ctx);
  const repositorio = repositorioPostulacionesPrisma();
  const postulacion = await repositorio.postulacionPorId(id);
  if (!postulacion) return null;
  return { postulacion, respuestas: await repositorio.respuestasDe(id) };
}

export async function contarPorEstado(ctx: ContextoPostulaciones): Promise<Record<EstadoPostulacion, number>> {
  exigirLecturaDePostulaciones(ctx);
  const todas = await repositorioPostulacionesPrisma().listarPostulaciones({});
  const conteo = {
    NUEVA: 0,
    EN_REVISION: 0,
    CONTACTADA: 0,
    ENTREVISTA: 0,
    APROBADA: 0,
    RECHAZADA: 0,
    ADOPCION_CONCRETADA: 0,
  } satisfies Record<EstadoPostulacion, number>;

  for (const postulacion of todas) conteo[postulacion.estado]++;
  return conteo;
}

export async function respuestasPorPostulacion(
  ids: string[],
  ctx: ContextoPostulaciones
): Promise<Map<string, Respuesta[]>> {
  exigirLecturaDePostulaciones(ctx);
  const repositorio = repositorioPostulacionesPrisma();
  const mapa = new Map<string, Respuesta[]>();
  for (const id of ids) mapa.set(id, await repositorio.respuestasDe(id));
  return mapa;
}

export interface EntradaHistorial {
  usuarioEmail: string;
  accion: string;
  valorAnterior: unknown;
  valorNuevo: unknown;
  creadoEn: Date;
}

/** El historial de una postulación es la secuencia de acciones administrativas que ya vive en la auditoría. */
export async function historialDePostulacion(
  id: string,
  ctx: ContextoPostulaciones
): Promise<EntradaHistorial[]> {
  exigirLecturaDePostulaciones(ctx);
  const entradas = await prisma.registroAuditoria.findMany({
    where: { entidad: "Postulacion", entidadId: id },
    orderBy: { creadoEn: "asc" },
  });
  return entradas.map((entrada) => ({
    usuarioEmail: entrada.usuarioEmail,
    accion: entrada.accion,
    valorAnterior: entrada.valorAnterior,
    valorNuevo: entrada.valorNuevo,
    creadoEn: entrada.creadoEn,
  }));
}
