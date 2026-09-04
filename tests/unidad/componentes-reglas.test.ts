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

  // Antes esta prueba solo pedía que el archivo tuviera alguna altura de 44px
  // o más. El botón chico declaraba 42 en otra regla del mismo archivo y
  // pasaba igual. Ahora se revisa cada altura declarada, una por una.
  it("todo control interactivo declara un área táctil suficiente", () => {
    for (const hoja of ["Boton.module.css", "Chip.module.css"]) {
      const alturas = [...contenido(hoja).matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
      expect(alturas.length, `${hoja} no declara ninguna altura mínima`).toBeGreaterThan(0);
      for (const altura of alturas) {
        expect(altura, `${hoja} declara un control de ${altura}px: el mínimo táctil es 44px`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  // El prototipo dibuja siluetas SVG al 52% del marco porque son marcadores de
  // posición. Una foto real tiene que llenar la placa entera: si hereda la
  // regla de la silueta, el animal aparece diminuto y centrado sobre un fondo
  // vacío. Son dos elementos con dos comportamientos distintos.
  it("la foto real llena el marco, la silueta de reemplazo no", () => {
    const hoja = contenido("Foto.module.css");

    const reglaImagen = hoja.match(/\.foto\s*>\s*img\s*\{([^}]*)\}/);
    expect(reglaImagen, "Foto.module.css no define una regla propia para .foto > img").not.toBeNull();
    expect(reglaImagen![1]).toMatch(/width:\s*100%/);
    expect(reglaImagen![1]).toMatch(/height:\s*100%/);
    expect(reglaImagen![1]).toMatch(/object-fit:\s*cover/);
    // La altura del marco sale de aspect-ratio, que para un hijo de grilla es
    // una altura indefinida: contra eso, height:100% cae en auto y la foto se
    // desborda hacia abajo, recortada por arriba. Posicionarla sobre el marco
    // la despega del cálculo de la grilla.
    expect(reglaImagen![1], "la foto tiene que cubrir el marco sin depender del alto de la grilla").toMatch(
      /position:\s*absolute/
    );

    const reglaSilueta = hoja.match(/\.foto\s*>\s*svg\s*\{([^}]*)\}/);
    expect(reglaSilueta, "Foto.module.css no define una regla propia para .foto > svg").not.toBeNull();
    expect(reglaSilueta![1]).toMatch(/width:\s*52%/);
  });

  // La etiqueta es solo un envoltorio que posiciona: la píldora que va adentro
  // trae su propio fondo y es ovalada. Si el envoltorio pinta su fondo, ese
  // rectángulo asoma por las puntas del óvalo.
  it("el envoltorio de la etiqueta no pinta fondo propio", () => {
    const reglaEtiqueta = contenido("Foto.module.css").match(/\.etiqueta\s*\{([^}]*)\}/);
    expect(reglaEtiqueta, "Foto.module.css no define .etiqueta").not.toBeNull();
    expect(reglaEtiqueta![1]).not.toMatch(/(^|[^-])background\s*:/);
  });
});
