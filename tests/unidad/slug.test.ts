import { describe, it, expect } from "vitest";
import { generarSlug, slugDisponible } from "@/domains/animales/slug";

describe("generarSlug", () => {
  it("pasa a minúsculas y une con guiones", () => {
    expect(generarSlug("Juanito Pérez")).toBe("juanito-perez");
  });

  it("quita acentos y la eñe se vuelve n", () => {
    expect(generarSlug("Ñoño")).toBe("nono");
  });

  it("descarta signos y espacios repetidos", () => {
    expect(generarSlug("  Luna  —  ¡cirugía!  ")).toBe("luna-cirugia");
  });

  it("nunca devuelve vacío", () => {
    expect(generarSlug("¿¡!")).toBe("animal");
  });
});

describe("slugDisponible", () => {
  it("devuelve el mismo si nadie lo usa", () => {
    expect(slugDisponible("luna", [])).toBe("luna");
  });

  it("agrega un sufijo numérico si ya existe", () => {
    expect(slugDisponible("luna", ["luna"])).toBe("luna-2");
    expect(slugDisponible("luna", ["luna", "luna-2"])).toBe("luna-3");
  });
});
