import { describe, it, expect } from "vitest";
import { agregarFoto, reordenarFotos, marcarSensible, definirPrincipal, listarFotos } from "@/domains/animales/fotos-servicio";
import { repositorioFotosEnMemoria } from "../dobles/repositorio-fotos-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

const datosFoto = {
  animalId: "animal-1",
  claveArchivo: "animales/animal-1/una-clave",
  alt: "Juanito mirando a cámara",
  sensible: false,
  ancho: 800,
  alto: 600,
  placeholder: "data:image/webp;base64,xxx",
};

function contexto(rol: "ADMINISTRACION" | "ANIMALES" | "REDACCION" | "FINANZAS" = "ANIMALES") {
  return {
    usuarioEmail: "marina@huellas.org.ar",
    rol,
    repositorio: repositorioFotosEnMemoria(),
    auditoria: auditoriaEnMemoria(),
  };
}

describe("agregarFoto", () => {
  it("la primera foto de un animal queda como principal", async () => {
    const ctx = contexto();
    const foto = await agregarFoto(datosFoto, ctx);
    expect(foto.principal).toBe(true);
    expect(foto.orden).toBe(0);
  });

  it("la segunda foto no es principal y sigue el orden", async () => {
    const ctx = contexto();
    await agregarFoto(datosFoto, ctx);
    const segunda = await agregarFoto(datosFoto, ctx);
    expect(segunda.principal).toBe(false);
    expect(segunda.orden).toBe(1);
  });

  it("rechaza a quien no tiene permiso de escritura sobre animales", async () => {
    const ctx = contexto("FINANZAS");
    await expect(agregarFoto(datosFoto, ctx)).rejects.toThrow(/permiso/i);
  });

  it("deja rastro en la auditoría", async () => {
    const ctx = contexto();
    const foto = await agregarFoto(datosFoto, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas.at(-1)).toMatchObject({ accion: "foto.agregar", entidadId: foto.id });
  });
});

describe("reordenarFotos", () => {
  it("aplica el nuevo orden a las fotos del animal", async () => {
    const ctx = contexto();
    const a = await agregarFoto(datosFoto, ctx);
    const b = await agregarFoto(datosFoto, ctx);
    const c = await agregarFoto(datosFoto, ctx);
    await reordenarFotos("animal-1", [c.id, a.id, b.id], ctx);
    const fotos = await listarFotos("animal-1", ctx);
    expect(fotos.map((f) => f.id)).toEqual([c.id, a.id, b.id]);
  });
});

describe("marcarSensible", () => {
  it("cambia la marca de sensible de una foto puntual", async () => {
    const ctx = contexto();
    const foto = await agregarFoto(datosFoto, ctx);
    const marcada = await marcarSensible(foto.id, true, ctx);
    expect(marcada.sensible).toBe(true);
  });
});

describe("definirPrincipal", () => {
  it("solo una foto del animal queda como principal", async () => {
    const ctx = contexto();
    const a = await agregarFoto(datosFoto, ctx);
    const b = await agregarFoto(datosFoto, ctx);
    await definirPrincipal(b.id, ctx);
    const fotos = await listarFotos("animal-1", ctx);
    expect(fotos.find((f) => f.id === a.id)?.principal).toBe(false);
    expect(fotos.find((f) => f.id === b.id)?.principal).toBe(true);
  });
});

describe("listarFotos", () => {
  it("permite leer a cualquier rol con permiso de lectura", async () => {
    const ctx = contexto("FINANZAS");
    await expect(listarFotos("animal-1", ctx)).resolves.toEqual([]);
  });
});
