import { describe, it, expect } from "vitest";
import { ordenarTrasReordenar, elegirPrincipal } from "@/domains/animales/fotos";

const fotos = [
  { id: "a", orden: 0, principal: true },
  { id: "b", orden: 1, principal: false },
  { id: "c", orden: 2, principal: false },
];

describe("orden de fotos", () => {
  it("reasigna el orden según la lista recibida", () => {
    expect(ordenarTrasReordenar(fotos, ["c", "a", "b"])).toEqual([
      { id: "c", orden: 0 },
      { id: "a", orden: 1 },
      { id: "b", orden: 2 },
    ]);
  });

  it("rechaza una lista que no contenga exactamente las mismas fotos", () => {
    expect(() => ordenarTrasReordenar(fotos, ["a", "b"])).toThrow(/todas las fotos/i);
  });
});

describe("foto principal", () => {
  it("solo puede haber una", () => {
    const resultado = elegirPrincipal(fotos, "c");
    expect(resultado.filter((f) => f.principal)).toHaveLength(1);
    expect(resultado.find((f) => f.principal)?.id).toBe("c");
  });

  it("si no hay ninguna marcada, la primera es la principal", () => {
    const sinPrincipal = fotos.map((f) => ({ ...f, principal: false }));
    expect(elegirPrincipal(sinPrincipal, null)[0].principal).toBe(true);
  });
});
