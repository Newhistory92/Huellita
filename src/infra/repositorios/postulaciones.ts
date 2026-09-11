import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import { FORMULARIO_BASE } from "@/domains/postulaciones/preguntas";
import type {
  FiltroPostulaciones,
  Postulacion,
  Pregunta,
  RepositorioPostulaciones,
  Respuesta,
} from "@/domains/postulaciones/tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

export function repositorioPostulacionesPrisma(cliente: ClienteBase = clientePorDefecto): RepositorioPostulaciones {
  return {
    async crearPregunta(datos) {
      // El formulario base es una fila única: se crea sola la primera vez.
      if (datos.formularioId) {
        await cliente.formularioAdopcion.upsert({
          where: { id: datos.formularioId },
          update: {},
          create: { id: datos.formularioId },
        });
      }
      return (await cliente.preguntaFormulario.create({ data: datos as never })) as unknown as Pregunta;
    },
    async actualizarPregunta(id, cambios) {
      return (await cliente.preguntaFormulario.update({ where: { id }, data: cambios as never })) as unknown as Pregunta;
    },
    async preguntaPorId(id) {
      return (await cliente.preguntaFormulario.findUnique({ where: { id } })) as unknown as Pregunta | null;
    },
    async preguntasDelFormulario() {
      return (await cliente.preguntaFormulario.findMany({
        where: { formularioId: FORMULARIO_BASE },
        orderBy: { orden: "asc" },
      })) as unknown as Pregunta[];
    },
    async preguntasDelAnimal(animalId) {
      return (await cliente.preguntaFormulario.findMany({
        where: { animalId },
        orderBy: { orden: "asc" },
      })) as unknown as Pregunta[];
    },

    async crearPostulacion(datos, respuestas) {
      return (await cliente.postulacion.create({
        data: { ...datos, respuestas: { create: respuestas } } as never,
      })) as unknown as Postulacion;
    },
    async actualizarPostulacion(id, cambios) {
      return (await cliente.postulacion.update({ where: { id }, data: cambios as never })) as unknown as Postulacion;
    },
    async postulacionPorId(id) {
      return (await cliente.postulacion.findUnique({ where: { id } })) as unknown as Postulacion | null;
    },
    async listarPostulaciones(filtro: FiltroPostulaciones) {
      return (await cliente.postulacion.findMany({
        where: { animalId: filtro.animalId, estado: filtro.estado },
        orderBy: { creadoEn: "desc" },
      })) as unknown as Postulacion[];
    },
    async respuestasDe(postulacionId) {
      return (await cliente.respuestaPostulacion.findMany({
        where: { postulacionId },
        orderBy: { orden: "asc" },
      })) as unknown as Respuesta[];
    },
    async postulacionRecienteDe(animalId, email, desde) {
      return (await cliente.postulacion.findFirst({
        // El dominio guarda el correo en minúsculas, así que la comparación
        // directa alcanza y usa el índice.
        where: { animalId, email: email.toLowerCase(), creadoEn: { gte: desde } },
        orderBy: { creadoEn: "desc" },
      })) as unknown as Postulacion | null;
    },
    async vaciarRespuestas(postulacionId) {
      await cliente.respuestaPostulacion.updateMany({ where: { postulacionId }, data: { valor: "" } });
    },
  };
}
