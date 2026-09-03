import { describe, it, expect } from "vitest";
import { crearAnimal } from "@/domains/animales/servicio";
import { repositorioEnMemoria, auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

const datosValidos = {
  nombre: "Juanito",
  especie: "PERRO" as const,
  sexo: "MACHO" as const,
  tamano: "MEDIANO" as const,
  descripcion: "Lo encontraron atado a un poste en barrio Tablada.",
};

function contexto(rol: "ADMINISTRACION" | "ANIMALES" | "REDACCION" | "FINANZAS" = "ANIMALES") {
  return {
    usuarioEmail: "marina@huellas.org.ar",
    rol,
    repositorio: repositorioEnMemoria(),
    auditoria: auditoriaEnMemoria(),
  };
}

describe("crearAnimal", () => {
  it("nace en borrador, sin publicar", async () => {
    const animal = await crearAnimal(datosValidos, contexto());
    expect(animal.estado).toBe("BORRADOR");
    expect(animal.publicadoEn).toBeNull();
  });

  it("le asigna una dirección permanente a partir del nombre", async () => {
    const animal = await crearAnimal(datosValidos, contexto());
    expect(animal.slug).toBe("juanito");
  });

  it("evita colisiones de dirección", async () => {
    const ctx = contexto();
    await crearAnimal(datosValidos, ctx);
    const segundo = await crearAnimal(datosValidos, ctx);
    expect(segundo.slug).toBe("juanito-2");
  });

  it("rechaza una descripción vacía", async () => {
    await expect(
      crearAnimal({ ...datosValidos, descripcion: "" }, contexto())
    ).rejects.toThrow(/descripción/i);
  });

  it("rechaza al rol de redacción aunque llame directo a la función", async () => {
    await expect(crearAnimal(datosValidos, contexto("REDACCION"))).rejects.toThrow(/permiso/i);
  });

  it("deja rastro en auditoría", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(datosValidos, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas).toHaveLength(1);
    expect(auditoria.entradas[0]).toMatchObject({
      accion: "animal.crear",
      entidad: "Animal",
      entidadId: animal.id,
      usuarioEmail: "marina@huellas.org.ar",
    });
  });
});
