import { describe, it, expect } from "vitest";
import { filtrarPorRespuesta } from "@/domains/postulaciones/consultas";
import type { Postulacion, Respuesta } from "@/domains/postulaciones/tipos";

const postulacion = (id: string): Postulacion => ({
  id,
  animalId: "animal-1",
  estado: "NUEVA",
  nombre: `Persona ${id}`,
  email: `${id}@ejemplo.org`,
  telefono: "341 555 0000",
  anonimizadaEn: null,
  creadoEn: new Date(),
});

const respuesta = (postulacionId: string, texto: string, valor: string): Respuesta => ({
  id: `r-${postulacionId}`,
  postulacionId,
  preguntaId: "p1",
  textoPregunta: texto,
  tipo: "SI_NO",
  valor,
  orden: 0,
});

const postulaciones = [postulacion("a"), postulacion("b"), postulacion("c")];
const respuestas = new Map([
  ["a", [respuesta("a", "¿Tenés patio cerrado?", "sí")]],
  ["b", [respuesta("b", "¿Tenés patio cerrado?", "no")]],
  ["c", [respuesta("c", "¿Tenés patio cerrado?", "sí")]],
]);

describe("filtrarPorRespuesta", () => {
  it("deja solo las que responden lo buscado", () => {
    const resultado = filtrarPorRespuesta(postulaciones, respuestas, "sí");
    expect(resultado.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("busca también en el texto de la pregunta", () => {
    expect(filtrarPorRespuesta(postulaciones, respuestas, "patio")).toHaveLength(3);
  });

  it("ignora mayúsculas y acentos", () => {
    expect(filtrarPorRespuesta(postulaciones, respuestas, "SI")).toHaveLength(2);
  });

  it("sin texto de búsqueda devuelve todas", () => {
    expect(filtrarPorRespuesta(postulaciones, respuestas, "   ")).toHaveLength(3);
  });

  it("una postulación sin respuestas no rompe el filtro", () => {
    const conHuerfana = [...postulaciones, postulacion("d")];
    expect(filtrarPorRespuesta(conHuerfana, respuestas, "sí").map((p) => p.id)).toEqual(["a", "c"]);
  });
});
