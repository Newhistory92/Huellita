import { describe, it, expect } from "vitest";
import { armarFormulario } from "@/domains/postulaciones/formulario";
import { crearPregunta, archivarPregunta } from "@/domains/postulaciones/preguntas";
import { repositorioPostulacionesEnMemoria } from "../dobles/repositorio-postulaciones-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

function contexto() {
  return {
    usuarioEmail: "marina@huellas.org.ar",
    rol: "ANIMALES" as const,
    repositorio: repositorioPostulacionesEnMemoria(),
    auditoria: auditoriaEnMemoria(),
  };
}

describe("armarFormulario", () => {
  it("pone primero las del formulario base y después las del animal", async () => {
    const ctx = contexto();
    await crearPregunta({ texto: "Base 1", tipo: "TEXTO_CORTO" }, ctx);
    await crearPregunta({ texto: "Base 2", tipo: "TEXTO_CORTO" }, ctx);
    await crearPregunta({ texto: "Del animal", tipo: "SI_NO", animalId: "animal-1" }, ctx);

    const preguntas = await armarFormulario("animal-1", ctx.repositorio);
    expect(preguntas.map((p) => p.texto)).toEqual(["Base 1", "Base 2", "Del animal"]);
  });

  it("no incluye las archivadas", async () => {
    const ctx = contexto();
    await crearPregunta({ texto: "Vigente", tipo: "TEXTO_CORTO" }, ctx);
    const vieja = await crearPregunta({ texto: "Archivada", tipo: "TEXTO_CORTO" }, ctx);
    await archivarPregunta(vieja.id, ctx);

    const preguntas = await armarFormulario("animal-1", ctx.repositorio);
    expect(preguntas.map((p) => p.texto)).toEqual(["Vigente"]);
  });

  it("no incluye las preguntas de otro animal", async () => {
    const ctx = contexto();
    await crearPregunta({ texto: "De Juanito", tipo: "SI_NO", animalId: "animal-1" }, ctx);
    await crearPregunta({ texto: "De Luna", tipo: "SI_NO", animalId: "animal-2" }, ctx);

    const preguntas = await armarFormulario("animal-1", ctx.repositorio);
    expect(preguntas.map((p) => p.texto)).toEqual(["De Juanito"]);
  });

  it("un animal sin preguntas propias usa solo el formulario base", async () => {
    const ctx = contexto();
    await crearPregunta({ texto: "Base", tipo: "TEXTO_CORTO" }, ctx);
    const preguntas = await armarFormulario("animal-sin-nada", ctx.repositorio);
    expect(preguntas.map((p) => p.texto)).toEqual(["Base"]);
  });
});
