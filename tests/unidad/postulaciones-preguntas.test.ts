import { describe, it, expect } from "vitest";
import { crearPregunta, editarPregunta, archivarPregunta, reordenarPreguntas } from "@/domains/postulaciones/preguntas";
import { repositorioPostulacionesEnMemoria } from "../dobles/repositorio-postulaciones-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import type { Rol } from "@/domains/postulaciones/tipos";

function contexto(rol: Rol = "ANIMALES") {
  return {
    usuarioEmail: "marina@huellas.org.ar",
    rol,
    repositorio: repositorioPostulacionesEnMemoria(),
    auditoria: auditoriaEnMemoria(),
  };
}

const base = { texto: "¿Tenés patio cerrado?", tipo: "SI_NO" as const, obligatoria: true };

describe("crearPregunta", () => {
  it("la agrega al formulario base cuando no se indica animal", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta(base, ctx);
    expect(pregunta.formularioId).not.toBeNull();
    expect(pregunta.animalId).toBeNull();
    expect(pregunta.archivada).toBe(false);
  });

  it("la agrega al animal cuando se indica uno", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta({ ...base, animalId: "animal-1" }, ctx);
    expect(pregunta.animalId).toBe("animal-1");
    expect(pregunta.formularioId).toBeNull();
  });

  it("la nueva queda al final del orden", async () => {
    const ctx = contexto();
    await crearPregunta(base, ctx);
    const segunda = await crearPregunta({ ...base, texto: "¿Vivís en casa o departamento?" }, ctx);
    expect(segunda.orden).toBe(1);
  });

  it("una pregunta de opciones exige al menos dos", async () => {
    const ctx = contexto();
    await expect(
      crearPregunta({ texto: "¿Dónde vivís?", tipo: "OPCION_MULTIPLE", opciones: ["Casa"] }, ctx)
    ).rejects.toThrow(/dos opciones/i);
  });

  it("una pregunta que no es de opciones no acepta opciones", async () => {
    const ctx = contexto();
    await expect(
      crearPregunta({ texto: "¿Tenés patio?", tipo: "SI_NO", opciones: ["Sí", "No"] }, ctx)
    ).rejects.toThrow(/no lleva opciones/i);
  });

  it("el rol de finanzas no puede tocar el formulario", async () => {
    await expect(crearPregunta(base, contexto("FINANZAS"))).rejects.toThrow(/permiso/i);
  });

  it("deja rastro en auditoría", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta(base, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas.at(-1)).toMatchObject({ accion: "pregunta.crear", entidadId: pregunta.id });
  });
});

describe("editarPregunta", () => {
  it("cambia el texto", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta(base, ctx);
    const editada = await editarPregunta(pregunta.id, { texto: "¿Tenés patio o balcón cerrado?" }, ctx);
    expect(editada.texto).toBe("¿Tenés patio o balcón cerrado?");
  });

  it("no permite cambiarle el tipo: las respuestas viejas quedarían sin sentido", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta(base, ctx);
    await expect(editarPregunta(pregunta.id, { tipo: "TEXTO_LARGO" } as never, ctx)).rejects.toThrow(/tipo/i);
  });
});

describe("archivarPregunta", () => {
  it("la archiva en vez de borrarla", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta(base, ctx);
    const archivada = await archivarPregunta(pregunta.id, ctx);
    expect(archivada.archivada).toBe(true);
    expect(await ctx.repositorio.preguntaPorId(pregunta.id)).not.toBeNull();
  });
});

describe("reordenarPreguntas", () => {
  it("reasigna el orden según la lista recibida", async () => {
    const ctx = contexto();
    const a = await crearPregunta({ ...base, texto: "Primera" }, ctx);
    const b = await crearPregunta({ ...base, texto: "Segunda" }, ctx);
    const c = await crearPregunta({ ...base, texto: "Tercera" }, ctx);

    await reordenarPreguntas([c.id, a.id, b.id], ctx);

    expect((await ctx.repositorio.preguntaPorId(c.id))!.orden).toBe(0);
    expect((await ctx.repositorio.preguntaPorId(a.id))!.orden).toBe(1);
    expect((await ctx.repositorio.preguntaPorId(b.id))!.orden).toBe(2);
  });

  it("rechaza una lista que no incluya todas las preguntas", async () => {
    const ctx = contexto();
    const a = await crearPregunta({ ...base, texto: "Primera" }, ctx);
    await crearPregunta({ ...base, texto: "Segunda" }, ctx);
    await expect(reordenarPreguntas([a.id], ctx)).rejects.toThrow(/todas las preguntas/i);
  });
});
