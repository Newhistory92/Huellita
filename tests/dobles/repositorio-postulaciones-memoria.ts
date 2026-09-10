import type {
  FiltroPostulaciones,
  Postulacion,
  Pregunta,
  RepositorioPostulaciones,
  Respuesta,
} from "@/domains/postulaciones/tipos";

export function repositorioPostulacionesEnMemoria() {
  const preguntas: Pregunta[] = [];
  const postulaciones: Postulacion[] = [];
  const respuestas: Respuesta[] = [];
  let secuencia = 0;
  const id = (prefijo: string) => `${prefijo}-${++secuencia}`;

  const repo: RepositorioPostulaciones = {
    async crearPregunta(datos) {
      const pregunta = { ...datos, id: id("pregunta") } as Pregunta;
      preguntas.push(pregunta);
      return pregunta;
    },
    async actualizarPregunta(idPregunta, cambios) {
      const i = preguntas.findIndex((p) => p.id === idPregunta);
      if (i === -1) throw new Error("No existe la pregunta");
      preguntas[i] = { ...preguntas[i], ...cambios };
      return preguntas[i];
    },
    async preguntaPorId(idPregunta) {
      return preguntas.find((p) => p.id === idPregunta) ?? null;
    },
    async preguntasDelFormulario() {
      return preguntas.filter((p) => p.formularioId !== null).sort((a, b) => a.orden - b.orden);
    },
    async preguntasDelAnimal(animalId) {
      return preguntas.filter((p) => p.animalId === animalId).sort((a, b) => a.orden - b.orden);
    },

    async crearPostulacion(datos, nuevasRespuestas) {
      const postulacion = { ...datos, id: id("postulacion"), creadoEn: new Date() } as Postulacion;
      postulaciones.push(postulacion);
      for (const respuesta of nuevasRespuestas) {
        respuestas.push({ ...respuesta, id: id("respuesta"), postulacionId: postulacion.id });
      }
      return postulacion;
    },
    async actualizarPostulacion(idPostulacion, cambios) {
      const i = postulaciones.findIndex((p) => p.id === idPostulacion);
      if (i === -1) throw new Error("No existe la postulación");
      postulaciones[i] = { ...postulaciones[i], ...cambios };
      return postulaciones[i];
    },
    async postulacionPorId(idPostulacion) {
      return postulaciones.find((p) => p.id === idPostulacion) ?? null;
    },
    async listarPostulaciones(filtro: FiltroPostulaciones) {
      return postulaciones.filter(
        (p) => (!filtro.animalId || p.animalId === filtro.animalId) && (!filtro.estado || p.estado === filtro.estado)
      );
    },
    async respuestasDe(postulacionId) {
      return respuestas.filter((r) => r.postulacionId === postulacionId).sort((a, b) => a.orden - b.orden);
    },
    async postulacionRecienteDe(animalId, email, desde) {
      return (
        postulaciones.find((p) => p.animalId === animalId && p.email === email && p.creadoEn >= desde) ?? null
      );
    },
    async vaciarRespuestas(postulacionId) {
      for (const respuesta of respuestas) {
        if (respuesta.postulacionId === postulacionId) respuesta.valor = "";
      }
    },
  };

  return Object.assign(repo, { preguntas, postulaciones, respuestas });
}
