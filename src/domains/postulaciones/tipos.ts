import type { PuertoAuditoria } from "@/domains/animales/tipos";

export type TipoRespuesta =
  | "TEXTO_CORTO"
  | "TEXTO_LARGO"
  | "SI_NO"
  | "OPCION_MULTIPLE"
  | "SELECCION_MULTIPLE"
  | "NUMERO"
  | "EMAIL"
  | "TELEFONO";

export type EstadoPostulacion =
  | "NUEVA"
  | "EN_REVISION"
  | "CONTACTADA"
  | "ENTREVISTA"
  | "APROBADA"
  | "RECHAZADA"
  | "ADOPCION_CONCRETADA";

export type Rol = "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";

export interface Pregunta {
  id: string;
  /** Una pregunta pertenece al formulario base o a un animal, nunca a los dos. */
  formularioId: string | null;
  animalId: string | null;
  texto: string;
  ayuda: string | null;
  tipo: TipoRespuesta;
  opciones: string[];
  obligatoria: boolean;
  orden: number;
  archivada: boolean;
}

export interface Respuesta {
  id: string;
  postulacionId: string;
  preguntaId: string | null;
  /** El recorte: qué se preguntó exactamente, en ese momento. */
  textoPregunta: string;
  tipo: TipoRespuesta;
  valor: string;
  orden: number;
}

export interface Postulacion {
  id: string;
  animalId: string;
  estado: EstadoPostulacion;
  nombre: string;
  email: string;
  telefono: string;
  anonimizadaEn: Date | null;
  creadoEn: Date;
}

export interface FiltroPostulaciones {
  animalId?: string;
  estado?: EstadoPostulacion;
}

export interface RepositorioPostulaciones {
  // Preguntas
  crearPregunta(datos: Omit<Pregunta, "id">): Promise<Pregunta>;
  actualizarPregunta(id: string, cambios: Partial<Pregunta>): Promise<Pregunta>;
  preguntaPorId(id: string): Promise<Pregunta | null>;
  preguntasDelFormulario(): Promise<Pregunta[]>;
  preguntasDelAnimal(animalId: string): Promise<Pregunta[]>;

  // Postulaciones
  crearPostulacion(datos: Omit<Postulacion, "id" | "creadoEn">, respuestas: Omit<Respuesta, "id" | "postulacionId">[]): Promise<Postulacion>;
  actualizarPostulacion(id: string, cambios: Partial<Postulacion>): Promise<Postulacion>;
  postulacionPorId(id: string): Promise<Postulacion | null>;
  listarPostulaciones(filtro: FiltroPostulaciones): Promise<Postulacion[]>;
  respuestasDe(postulacionId: string): Promise<Respuesta[]>;
  /** Para el control de envío repetido. Ver §5.3 de la especificación. */
  postulacionRecienteDe(animalId: string, email: string, desde: Date): Promise<Postulacion | null>;
  /** Borra el contenido de todas las respuestas, conservando las filas. */
  vaciarRespuestas(postulacionId: string): Promise<void>;
}

export interface ContextoPostulaciones {
  usuarioEmail: string;
  rol: Rol;
  repositorio: RepositorioPostulaciones;
  auditoria: PuertoAuditoria;
}
