import type { Pregunta, RepositorioPostulaciones } from "./tipos";

/**
 * El formulario que ve una persona: las preguntas activas del formulario base,
 * en su orden, seguidas de las propias de ese animal.
 *
 * Las archivadas no aparecen. Las postulaciones viejas que las respondieron
 * conservan igual el texto de lo que se preguntó.
 */
export async function armarFormulario(
  animalId: string,
  repositorio: RepositorioPostulaciones
): Promise<Pregunta[]> {
  const [base, propias] = await Promise.all([
    repositorio.preguntasDelFormulario(),
    repositorio.preguntasDelAnimal(animalId),
  ]);

  const activas = (preguntas: Pregunta[]) =>
    preguntas.filter((p) => !p.archivada).sort((a, b) => a.orden - b.orden);

  return [...activas(base), ...activas(propias)];
}
