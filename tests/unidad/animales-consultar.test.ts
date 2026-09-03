import { describe, it, expect } from "vitest";
import { crearAnimal, listarAnimales, obtenerAnimal } from "@/domains/animales/servicio";
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

describe("listarAnimales", () => {
  it("devuelve los animales que coinciden con el filtro", async () => {
    const ctx = contexto();
    await crearAnimal(datosValidos, ctx);
    const listado = await listarAnimales({ especie: "PERRO" }, ctx);
    expect(listado).toHaveLength(1);
  });

  it("permite leer a cualquier rol con permiso de lectura", async () => {
    const ctx = contexto("FINANZAS");
    await expect(listarAnimales({}, ctx)).resolves.toEqual([]);
  });
});

describe("obtenerAnimal", () => {
  it("devuelve el animal por id", async () => {
    const ctx = contexto();
    const creado = await crearAnimal(datosValidos, ctx);
    const encontrado = await obtenerAnimal(creado.id, ctx);
    expect(encontrado.id).toBe(creado.id);
  });

  it("rechaza un id inexistente", async () => {
    await expect(obtenerAnimal("no-existe", contexto())).rejects.toThrow(/no existe/i);
  });
});
