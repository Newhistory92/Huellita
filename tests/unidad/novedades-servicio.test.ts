import { describe, it, expect } from "vitest";
import { crearNovedad, editarNovedad, archivarNovedad } from "@/domains/novedades/servicio";
import { repositorioNovedadesEnMemoria } from "../dobles/repositorio-novedades-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import type { Rol } from "@/domains/novedades/tipos";

function contexto(rol: Rol = "REDACCION") {
  return {
    usuarioEmail: "marina@huellas.org.ar",
    rol,
    repositorio: repositorioNovedadesEnMemoria(),
    auditoria: auditoriaEnMemoria(),
  };
}

const base = { casoId: "caso-1", titulo: "Luna salió bien de la cirugía", cuerpo: "Está estable y comiendo." };

describe("crearNovedad", () => {
  it("nace publicada: no hay borradores", async () => {
    const novedad = await crearNovedad(base, contexto());
    expect(novedad.archivada).toBe(false);
    expect(novedad.creadoEn).toBeInstanceOf(Date);
  });

  it("guarda quién la escribió", async () => {
    const novedad = await crearNovedad(base, contexto());
    expect(novedad.autorEmail).toBe("marina@huellas.org.ar");
  });

  it("acepta una novedad colgada de un animal", async () => {
    const novedad = await crearNovedad({ animalId: "animal-1", titulo: "Juanito ya está recuperado", cuerpo: "Come bien." }, contexto());
    expect(novedad.animalId).toBe("animal-1");
    expect(novedad.casoId).toBeNull();
  });

  // La regla de la §3.2: exactamente uno. Ni los dos, ni ninguno.
  it("rechaza una novedad colgada de un caso Y de un animal", async () => {
    await expect(
      crearNovedad({ casoId: "caso-1", animalId: "animal-1", titulo: "Doble", cuerpo: "No debería poder." }, contexto())
    ).rejects.toThrow(/exactamente un/i);
  });

  it("rechaza una novedad que no cuelga de nada", async () => {
    await expect(crearNovedad({ titulo: "Huérfana", cuerpo: "No cuelga de nada." }, contexto())).rejects.toThrow(/exactamente un/i);
  });

  it("rechaza un título vacío", async () => {
    await expect(crearNovedad({ ...base, titulo: "   " }, contexto())).rejects.toThrow(/título/i);
  });

  it("rechaza un título de más de 120 caracteres", async () => {
    await expect(crearNovedad({ ...base, titulo: "a".repeat(121) }, contexto())).rejects.toThrow(/120/);
  });

  it("rechaza un cuerpo de más de 4000 caracteres", async () => {
    await expect(crearNovedad({ ...base, cuerpo: "a".repeat(4001) }, contexto())).rejects.toThrow(/4000/);
  });

  it("el rol de finanzas no escribe novedades: solo escribe dinero", async () => {
    await expect(crearNovedad(base, contexto("FINANZAS"))).rejects.toThrow(/permiso/i);
  });

  it("redacción sí puede", async () => {
    await expect(crearNovedad(base, contexto("REDACCION"))).resolves.toBeDefined();
  });

  it("deja rastro en auditoría", async () => {
    const ctx = contexto();
    const novedad = await crearNovedad(base, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas.at(-1)).toMatchObject({ accion: "novedad.crear", entidadId: novedad.id });
  });
});

describe("editarNovedad", () => {
  it("corrige el texto: no es un asiento contable", async () => {
    const ctx = contexto();
    const novedad = await crearNovedad(base, ctx);
    const editada = await editarNovedad(novedad.id, { titulo: "Luna salió muy bien de la cirugía" }, ctx);
    expect(editada.titulo).toBe("Luna salió muy bien de la cirugía");
  });

  it("no permite mudarla de un caso a un animal", async () => {
    const ctx = contexto();
    const novedad = await crearNovedad(base, ctx);
    const editada = await editarNovedad(novedad.id, { animalId: "animal-1" } as never, ctx);
    expect(editada.animalId).toBeNull();
    expect(editada.casoId).toBe("caso-1");
  });
});

describe("archivarNovedad", () => {
  it("la archiva en vez de borrarla", async () => {
    const ctx = contexto();
    const novedad = await crearNovedad(base, ctx);
    const archivada = await archivarNovedad(novedad.id, ctx);

    expect(archivada.archivada).toBe(true);
    expect(await ctx.repositorio.porId(novedad.id)).not.toBeNull();
  });

  it("una archivada desaparece de las del caso", async () => {
    const ctx = contexto();
    const novedad = await crearNovedad(base, ctx);
    await archivarNovedad(novedad.id, ctx);
    expect(await ctx.repositorio.delCaso("caso-1")).toHaveLength(0);
  });
});
