import { describe, it, expect } from "vitest";
import { ordenarTrasReordenar, elegirPrincipal, urlDeFoto } from "@/domains/animales/fotos";

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

describe("urlDeFoto", () => {
  it("pide la medida solicitada cuando la foto es más grande", () => {
    expect(urlDeFoto({ claveArchivo: "animales/a/x", ancho: 2000 }, 1024)).toBe("/archivos/animales/a/x-1024.webp");
  });

  // El pipeline nunca agranda una imagen: para una foto de 768px de ancho,
  // la medida de 1024 se guarda como -768. Pedir -1024 da 404 y la ficha
  // aparece con la foto rota, que es lo que le pasaría a cualquier animal
  // cuya foto venga de un teléfono viejo o de una captura de Facebook.
  it("no pide una medida mayor que el original", () => {
    expect(urlDeFoto({ claveArchivo: "animales/a/x", ancho: 768 }, 1024)).toBe("/archivos/animales/a/x-768.webp");
  });

  it("recorta también las medidas chicas en una foto diminuta", () => {
    expect(urlDeFoto({ claveArchivo: "animales/a/x", ancho: 200 }, 320)).toBe("/archivos/animales/a/x-200.webp");
  });
});

describe("urlDeFoto según dónde vivan los archivos", () => {
  const foto = { claveArchivo: "animales/a/x", ancho: 2000 };

  it("sin almacén en la nube, sirve por la ruta propia de la aplicación", () => {
    expect(urlDeFoto(foto, 640, "")).toBe("/archivos/animales/a/x-640.webp");
  });

  it("con almacén en la nube, apunta directo al depósito", () => {
    expect(urlDeFoto(foto, 640, "https://fotos.refugiohuellas.org.ar")).toBe(
      "https://fotos.refugiohuellas.org.ar/animales/a/x-640.webp"
    );
  });

  // Una barra de más produce direcciones con doble barra: funcionan en algunos
  // servidores y en otros no, y el error aparece recién en producción.
  it("tolera que la dirección base termine en barra", () => {
    expect(urlDeFoto(foto, 640, "https://fotos.refugiohuellas.org.ar/")).toBe(
      "https://fotos.refugiohuellas.org.ar/animales/a/x-640.webp"
    );
  });

  it("sigue recortando la medida al ancho real aunque esté en la nube", () => {
    expect(urlDeFoto({ claveArchivo: "animales/a/x", ancho: 480 }, 1024, "https://fotos.org.ar")).toBe(
      "https://fotos.org.ar/animales/a/x-480.webp"
    );
  });
});
