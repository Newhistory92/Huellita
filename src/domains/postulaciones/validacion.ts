import type { Pregunta } from "./tipos";

export type ResultadoValidacion = { ok: true; valor: string } | { ok: false; error: string };

const LARGO_MAXIMO: Record<string, number> = { TEXTO_CORTO: 200, TEXTO_LARGO: 4000 };

/**
 * Valida una respuesta contra el tipo de su pregunta.
 *
 * Corre en el servidor. La validación del navegador es una comodidad para
 * quien completa el formulario, no una garantía: el formulario se puede
 * enviar sin navegador, y entonces lo único que protege los datos es esto.
 */
export function validarRespuesta(pregunta: Pregunta, valorCrudo: string | string[]): ResultadoValidacion {
  const esLista = Array.isArray(valorCrudo);
  const vacio = esLista ? valorCrudo.length === 0 : valorCrudo.trim().length === 0;

  if (vacio) {
    return pregunta.obligatoria
      ? { ok: false, error: `Completá "${pregunta.texto}": es obligatoria` }
      : { ok: true, valor: "" };
  }

  switch (pregunta.tipo) {
    case "TEXTO_CORTO":
    case "TEXTO_LARGO": {
      const valor = String(valorCrudo).trim();
      const maximo = LARGO_MAXIMO[pregunta.tipo];
      if (valor.length > maximo) {
        return { ok: false, error: `La respuesta a "${pregunta.texto}" no puede pasar de ${maximo} caracteres` };
      }
      return { ok: true, valor };
    }

    case "SI_NO": {
      const normalizado = String(valorCrudo).trim().toLowerCase();
      if (normalizado === "si" || normalizado === "sí") return { ok: true, valor: "sí" };
      if (normalizado === "no") return { ok: true, valor: "no" };
      return { ok: false, error: `Respondé "${pregunta.texto}" con sí o no` };
    }

    case "OPCION_MULTIPLE": {
      const valor = String(valorCrudo).trim();
      if (!pregunta.opciones.includes(valor)) {
        return { ok: false, error: `"${valor}" no es una opción de "${pregunta.texto}"` };
      }
      return { ok: true, valor };
    }

    case "SELECCION_MULTIPLE": {
      const valores = (esLista ? valorCrudo : [String(valorCrudo)]).map((v) => v.trim());
      const invalida = valores.find((v) => !pregunta.opciones.includes(v));
      if (invalida) {
        return { ok: false, error: `"${invalida}" no es una opción de "${pregunta.texto}"` };
      }
      // Se guardan separados por salto de línea: el tipo dice cómo leerlo.
      return { ok: true, valor: valores.join("\n") };
    }

    case "NUMERO": {
      const valor = String(valorCrudo).trim();
      if (!Number.isFinite(Number(valor))) {
        return { ok: false, error: `Respondé "${pregunta.texto}" con un número` };
      }
      return { ok: true, valor };
    }

    case "EMAIL": {
      const valor = String(valorCrudo).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
        return { ok: false, error: `"${valor}" no parece un correo electrónico` };
      }
      return { ok: true, valor };
    }

    case "TELEFONO": {
      const valor = String(valorCrudo).trim();
      if (!/^[\d\s\-()+]{8,20}$/.test(valor)) {
        return { ok: false, error: `"${valor}" no parece un teléfono` };
      }
      return { ok: true, valor };
    }
  }
}
