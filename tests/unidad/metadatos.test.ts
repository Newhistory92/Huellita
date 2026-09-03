import { describe, it, expect } from "vitest";
import { metadatosDeAnimal } from "@/domains/animales/metadatos";

const animal = {
  id: "1", slug: "juanito", nombre: "Juanito", especie: "PERRO" as const, sexo: "MACHO" as const,
  tamano: "MEDIANO" as const, descripcion: "Lo encontraron atado a un poste en barrio Tablada. Hoy pesa 18 kilos.",
  castrado: true, vacunasAlDia: true,
  estado: "DISPONIBLE" as const, archivado: false, publicadoEn: new Date(), atributos: {},
};

describe("metadatosDeAnimal", () => {
  it("arma un título único y descriptivo", () => {
    expect(metadatosDeAnimal(animal).title).toBe("Juanito — Perro en adopción");
  });

  it("dice que fue adoptado cuando corresponde", () => {
    expect(metadatosDeAnimal({ ...animal, estado: "ADOPTADO" }).title).toBe("Juanito — Adoptado");
  });

  it("recorta la descripción sin cortar una palabra al medio", () => {
    const desc = metadatosDeAnimal(animal).description!;
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(desc.endsWith(" …")).toBe(false);
  });

  it("declara la dirección canónica", () => {
    expect(metadatosDeAnimal(animal).alternates?.canonical).toBe("/adopcion/juanito");
  });
});
