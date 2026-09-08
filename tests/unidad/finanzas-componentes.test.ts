import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = "src/ui/finanzas";
const hojas = () => readdirSync(dir).filter((f) => f.endsWith(".module.css"));
const contenido = (archivo: string) => readFileSync(path.join(dir, archivo), "utf8");

describe("reglas visuales del dinero", () => {
  it("ningún componente escribe un color literal", () => {
    for (const hoja of hojas()) {
      expect(contenido(hoja).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toHaveLength(0);
    }
  });

  it("los ingresos usan el verde contable y los egresos el rojo, no el naranja", () => {
    const importe = contenido("Importe.module.css");
    expect(importe).toMatch(/var\(--ok\)/);
    expect(importe).toMatch(/var\(--bad\)/);
    expect(importe, "el naranja está reservado a las acciones de donar").not.toMatch(/var\(--accent\)/);
  });

  it("la barra de recaudación sí usa el naranja: es la señal del dinero", () => {
    expect(contenido("Medidor.module.css")).toMatch(/var\(--accent\)/);
  });

  it("los importes van en monoespaciada con cifras alineadas", () => {
    expect(contenido("Importe.module.css")).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});
