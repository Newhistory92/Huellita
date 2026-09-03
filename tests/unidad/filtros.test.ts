import { describe, it, expect } from "vitest";
import { filtroDesdeParametros } from "@/domains/animales/consultas";

describe("filtroDesdeParametros", () => {
  it("traduce los parámetros de la dirección", () => {
    expect(filtroDesdeParametros({ tamano: "pequeno", especie: "gato" })).toEqual({
      tamano: "PEQUENO",
      especie: "GATO",
      soloPublicados: true,
    });
  });

  it("ignora valores que no existen en lugar de romper", () => {
    expect(filtroDesdeParametros({ tamano: "gigante" })).toEqual({ soloPublicados: true });
  });

  it("sin parámetros devuelve solo los publicados", () => {
    expect(filtroDesdeParametros({})).toEqual({ soloPublicados: true });
  });

  it("traduce el estado cuando corresponde", () => {
    expect(filtroDesdeParametros({ estado: "disponible" })).toEqual({
      estado: "DISPONIBLE",
      soloPublicados: true,
    });
  });
});
