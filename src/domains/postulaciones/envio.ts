import type { PuertoAuditoria } from "@/domains/animales/tipos";
import type { PuertoAvisos } from "@/domains/avisos/tipos";
import { armarFormulario } from "./formulario";
import { validarRespuesta } from "./validacion";
import type { Postulacion, RepositorioPostulaciones, Respuesta } from "./tipos";

/** Ventana del control contra el doble clic. Ver §5.3 de la especificación. */
export const MINUTOS_CONTRA_REPETIDO = 5;

export interface EntradaPostulacion {
  animalId: string;
  /** Quien llama ya tiene el animal cargado: evita que este puerto necesite leerlo. */
  nombreAnimal: string;
  nombre: string;
  email: string;
  telefono: string;
  /** Respuestas por identificador de pregunta. */
  respuestas: Record<string, string | string[]>;
}

function validarContacto(entrada: EntradaPostulacion): void {
  if (entrada.nombre.trim().length === 0) throw new Error("Escribí tu nombre y apellido");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entrada.email.trim())) {
    throw new Error("Revisá el correo: no parece una dirección válida");
  }
  if (!/^[\d\s\-()+]{8,20}$/.test(entrada.telefono.trim())) {
    throw new Error("Revisá el teléfono: escribilo con código de área");
  }
}

/**
 * Envío público: no exige sesión ni permisos, igual que la declaración de
 * transferencias de la entrega 2. Lo que protege los datos es la validación,
 * no la autenticación.
 */
export async function enviarPostulacion(
  entrada: EntradaPostulacion,
  repositorio: RepositorioPostulaciones,
  auditoria: PuertoAuditoria,
  avisos: PuertoAvisos
): Promise<{ postulacion: Postulacion; repetida: boolean }> {
  validarContacto(entrada);

  const email = entrada.email.trim().toLowerCase();

  // Contra el doble clic: si ya mandó una para este animal hace un rato, se
  // devuelve esa. Quien la envía ve la misma confirmación, no un error: desde
  // su lado el envío funcionó, porque su postulación está registrada.
  const desde = new Date(Date.now() - MINUTOS_CONTRA_REPETIDO * 60 * 1000);
  const reciente = await repositorio.postulacionRecienteDe(entrada.animalId, email, desde);
  if (reciente) return { postulacion: reciente, repetida: true };

  const preguntas = await armarFormulario(entrada.animalId, repositorio);

  const respuestas: Omit<Respuesta, "id" | "postulacionId">[] = [];
  for (const [orden, pregunta] of preguntas.entries()) {
    const valorCrudo = entrada.respuestas[pregunta.id] ?? "";
    const resultado = validarRespuesta(pregunta, valorCrudo);
    if (!resultado.ok) throw new Error(resultado.error);

    // Una pregunta opcional que nadie contestó no deja fila: guardar una
    // respuesta vacía no aporta nada y ensucia el conteo de "ignora
    // respuestas a preguntas que no están en el formulario".
    if (!pregunta.obligatoria && resultado.valor === "") continue;

    respuestas.push({
      preguntaId: pregunta.id,
      // El recorte: si mañana editan o archivan la pregunta, esto sigue
      // diciendo qué se preguntó de verdad.
      textoPregunta: pregunta.texto,
      tipo: pregunta.tipo,
      valor: resultado.valor,
      orden,
    });
  }

  const postulacion = await repositorio.crearPostulacion(
    {
      animalId: entrada.animalId,
      estado: "NUEVA",
      nombre: entrada.nombre.trim(),
      email,
      telefono: entrada.telefono.trim(),
      anonimizadaEn: null,
    },
    respuestas
  );

  await auditoria.registrar({
    usuarioEmail: "público",
    accion: "postulacion.enviar",
    entidad: "Postulacion",
    entidadId: postulacion.id,
    // Sin datos de contacto: la bitácora no es lugar para una segunda copia,
    // y el borrado a pedido no la alcanzaría.
    valorNuevo: { animalId: entrada.animalId, cantidadRespuestas: respuestas.length },
  });

  await avisos.anotar({
    tipo: "POSTULACION_NUEVA",
    datos: { postulacionId: postulacion.id, animalId: entrada.animalId, nombreAnimal: entrada.nombreAnimal },
    originadoPorEmail: null,
  });

  return { postulacion, repetida: false };
}
