import { describe, it, expect } from "vitest";
import { crearAnimal, publicarAnimal, editarAnimal, cambiarEstado, archivarAnimal } from "@/domains/animales/servicio";
import { repositorioEnMemoria, auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

const base = {
  nombre: "Juanito",
  especie: "PERRO" as const,
  sexo: "MACHO" as const,
  tamano: "MEDIANO" as const,
  descripcion: "Lo encontraron atado a un poste en barrio Tablada.",
};

function contexto() {
  return {
    usuarioEmail: "marina@huellas.org.ar",
    rol: "ANIMALES" as const,
    repositorio: repositorioEnMemoria(),
    auditoria: auditoriaEnMemoria(),
  };
}

describe("ciclo de vida del animal", () => {
  it("al publicar pasa a disponible y queda la fecha", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(base, ctx);
    const publicado = await publicarAnimal(animal.id, ctx);
    expect(publicado.estado).toBe("DISPONIBLE");
    expect(publicado.publicadoEn).toBeInstanceOf(Date);
  });

  it("no publica un animal sin descripción suficiente", async () => {
    const ctx = contexto();
    const animal = await ctx.repositorio.crear({
      slug: "corto", nombre: "Corto", especie: "PERRO", sexo: "MACHO", tamano: "MEDIANO",
      descripcion: "corta", estado: "BORRADOR", archivado: false, publicadoEn: null, atributos: {},
    });
    await expect(publicarAnimal(animal.id, ctx)).rejects.toThrow(/descripción/i);
  });

  it("la dirección permanente NO cambia al corregir el nombre", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(base, ctx);
    const editado = await editarAnimal(animal.id, { nombre: "Juan Ramón" }, ctx);
    expect(editado.nombre).toBe("Juan Ramón");
    expect(editado.slug).toBe("juanito");
  });

  it("un animal adoptado sigue publicado", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(base, ctx);
    await publicarAnimal(animal.id, ctx);
    const adoptado = await cambiarEstado(animal.id, "ADOPTADO", ctx);
    expect(adoptado.estado).toBe("ADOPTADO");
    expect(adoptado.archivado).toBe(false);
    expect(adoptado.publicadoEn).not.toBeNull();
  });

  it("archivar no borra: la ficha sigue existiendo", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(base, ctx);
    await archivarAnimal(animal.id, ctx);
    expect(await ctx.repositorio.porSlug("juanito")).not.toBeNull();
  });

  it("cada cambio de estado deja su rastro con valor anterior y nuevo", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(base, ctx);
    await cambiarEstado(animal.id, "TRATAMIENTO", ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    const ultima = auditoria.entradas.at(-1)!;
    expect(ultima.accion).toBe("animal.cambiarEstado");
    expect(ultima.valorAnterior).toMatchObject({ estado: "BORRADOR" });
    expect(ultima.valorNuevo).toMatchObject({ estado: "TRATAMIENTO" });
  });
});
