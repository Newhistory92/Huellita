import { unstable_cache } from "next/cache";
import { paraCache, desdeCache } from "@/domains/finanzas/consultas";
import { repositorioPostulacionesPrisma } from "@/infra/repositorios/postulaciones";
import { armarFormulario } from "./formulario";
import type { EstadoPostulacion, FiltroPostulaciones, Postulacion, Pregunta, Respuesta } from "./tipos";

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
 */
export async function postulacionesDelPanel(filtro: FiltroPostulaciones): Promise<Postulacion[]> {
  return repositorioPostulacionesPrisma().listarPostulaciones(filtro);
}

export async function detalleDePostulacion(
  id: string
): Promise<{ postulacion: Postulacion; respuestas: Respuesta[] } | null> {
  const repositorio = repositorioPostulacionesPrisma();
  const postulacion = await repositorio.postulacionPorId(id);
  if (!postulacion) return null;
  return { postulacion, respuestas: await repositorio.respuestasDe(id) };
}

export async function contarPorEstado(): Promise<Record<EstadoPostulacion, number>> {
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

export async function respuestasPorPostulacion(ids: string[]): Promise<Map<string, Respuesta[]>> {
  const repositorio = repositorioPostulacionesPrisma();
  const mapa = new Map<string, Respuesta[]>();
  for (const id of ids) mapa.set(id, await repositorio.respuestasDe(id));
  return mapa;
}
