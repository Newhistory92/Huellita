import { describe, it, expect } from "vitest";
import { validarRespuesta } from "@/domains/postulaciones/validacion";
import type { Pregunta, TipoRespuesta } from "@/domains/postulaciones/tipos";

function pregunta(tipo: TipoRespuesta, extra: Partial<Pregunta> = {}): Pregunta {
  return {
    id: "p1",
    formularioId: "f1",
    animalId: null,
    texto: "Pregunta de prueba",
    ayuda: null,
    tipo,
    opciones: [],
    obligatoria: false,
    orden: 0,
    archivada: false,
    ...extra,
  };
}

describe("obligatoriedad", () => {
  it("una obligatoria vacía se rechaza", () => {
    const resultado = validarRespuesta(pregunta("TEXTO_CORTO", { obligatoria: true }), "   ");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/obligatoria|completá/i);
  });

  it("una opcional vacía se acepta y queda en blanco", () => {
    const resultado = validarRespuesta(pregunta("TEXTO_CORTO"), "");
    expect(resultado).toEqual({ ok: true, valor: "" });
  });
});

describe("texto", () => {
  it("recorta los espacios de los extremos", () => {
    expect(validarRespuesta(pregunta("TEXTO_CORTO"), "  Marina  ")).toEqual({ ok: true, valor: "Marina" });
  });

  it("rechaza un texto corto de más de 200 caracteres", () => {
    const resultado = validarRespuesta(pregunta("TEXTO_CORTO"), "a".repeat(201));
    expect(resultado.ok).toBe(false);
  });

  it("acepta un texto largo de 4000 caracteres", () => {
    expect(validarRespuesta(pregunta("TEXTO_LARGO"), "a".repeat(4000)).ok).toBe(true);
  });

  it("rechaza un texto largo de más de 4000", () => {
    expect(validarRespuesta(pregunta("TEXTO_LARGO"), "a".repeat(4001)).ok).toBe(false);
  });
});

describe("sí o no", () => {
  it("acepta sí y no, con o sin tilde", () => {
    expect(validarRespuesta(pregunta("SI_NO"), "sí")).toEqual({ ok: true, valor: "sí" });
    expect(validarRespuesta(pregunta("SI_NO"), "si")).toEqual({ ok: true, valor: "sí" });
    expect(validarRespuesta(pregunta("SI_NO"), "No")).toEqual({ ok: true, valor: "no" });
  });

  it("rechaza cualquier otra cosa", () => {
    expect(validarRespuesta(pregunta("SI_NO"), "más o menos").ok).toBe(false);
  });
});

describe("opciones", () => {
  const conOpciones = pregunta("OPCION_MULTIPLE", { opciones: ["Casa con patio", "Departamento"] });

  it("acepta una opción de la lista", () => {
    expect(validarRespuesta(conOpciones, "Departamento")).toEqual({ ok: true, valor: "Departamento" });
  });

  it("rechaza una opción inventada: es el caso del envío sin navegador", () => {
    const resultado = validarRespuesta(conOpciones, "Carpa");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/opci/i);
  });

  it("la selección múltiple acepta varias y las guarda separadas por salto de línea", () => {
    const multiple = pregunta("SELECCION_MULTIPLE", { opciones: ["Perros", "Gatos", "Ninguno"] });
    expect(validarRespuesta(multiple, ["Perros", "Gatos"])).toEqual({ ok: true, valor: "Perros\nGatos" });
  });

  it("la selección múltiple rechaza si una sola no está en la lista", () => {
    const multiple = pregunta("SELECCION_MULTIPLE", { opciones: ["Perros", "Gatos"] });
    expect(validarRespuesta(multiple, ["Perros", "Iguanas"]).ok).toBe(false);
  });
});

describe("número, correo y teléfono", () => {
  it("acepta un número", () => {
    expect(validarRespuesta(pregunta("NUMERO"), "3")).toEqual({ ok: true, valor: "3" });
  });

  it("rechaza un número que no lo es", () => {
    expect(validarRespuesta(pregunta("NUMERO"), "tres").ok).toBe(false);
  });

  it("acepta un correo con forma de correo", () => {
    expect(validarRespuesta(pregunta("EMAIL"), "marina@ejemplo.org").ok).toBe(true);
  });

  it("rechaza un correo sin arroba", () => {
    expect(validarRespuesta(pregunta("EMAIL"), "marina.ejemplo.org").ok).toBe(false);
  });

  it("acepta un teléfono con espacios, guiones y prefijo", () => {
    expect(validarRespuesta(pregunta("TELEFONO"), "+54 341 555-0000").ok).toBe(true);
  });

  it("rechaza un teléfono con letras", () => {
    expect(validarRespuesta(pregunta("TELEFONO"), "llamame").ok).toBe(false);
  });

  it("rechaza un teléfono demasiado corto", () => {
    expect(validarRespuesta(pregunta("TELEFONO"), "1234").ok).toBe(false);
  });
});
