import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = "src/ui/componentes";
const hojas = readdirSync(dir).filter((f) => f.endsWith(".module.css"));

function contenido(archivo: string): string {
  return readFileSync(path.join(dir, archivo), "utf8");
}

describe("reglas del sistema de diseño", () => {
  it("ningún componente escribe un color literal", () => {
    for (const hoja of hojas) {
      const literales = contenido(hoja).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      expect(literales, `${hoja} tiene colores literales: ${literales.join(", ")}`).toHaveLength(0);
    }
  });

  it("solo el botón de donar usa el acento naranja", () => {
    for (const hoja of hojas) {
      if (hoja === "Boton.module.css") continue;
      expect(contenido(hoja).includes("var(--accent)"), `${hoja} usa el naranja reservado al dinero`).toBe(false);
    }
  });

  it("todo control interactivo declara un área táctil suficiente", () => {
    for (const hoja of ["Boton.module.css", "Chip.module.css"]) {
      expect(contenido(hoja)).toMatch(/min-height:\s*(4[4-9]|[5-9]\d)px/);
    }
  });
});
