import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("src/ui/tokens.css", "utf8");

/** Extrae los nombres de variables definidas dentro de un bloque. */
function variablesEn(bloque: string): Set<string> {
  return new Set([...bloque.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
}

function bloque(selector: string): string {
  const i = css.indexOf(selector);
  if (i === -1) throw new Error(`No existe el bloque ${selector}`);
  const desde = css.indexOf("{", i);
  const hasta = css.indexOf("}", desde);
  return css.slice(desde, hasta);
}

describe("tokens del sistema de diseño", () => {
  it("define la paleta clara completa en :root sin marcar", () => {
    const claras = variablesEn(bloque(":root{"));
    expect(claras.has("--ground")).toBe(true);
    expect(claras.has("--accent")).toBe(true);
    expect(claras.has("--mark")).toBe(true);
  });

  it("redefine en oscuro exactamente las mismas variables que en claro", () => {
    const claras = variablesEn(bloque(":root{"));
    const oscuras = variablesEn(bloque(':root:not([data-theme="light"])'));
    expect([...oscuras].sort()).toEqual([...claras].sort());
  });

  it("resuelve también el tema oscuro elegido explícitamente", () => {
    const claras = variablesEn(bloque(":root{"));
    const estampadas = variablesEn(bloque(':root[data-theme="dark"]'));
    expect([...estampadas].sort()).toEqual([...claras].sort());
  });
});
