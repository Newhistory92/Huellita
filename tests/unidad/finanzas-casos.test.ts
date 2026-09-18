import { describe, it, expect } from "vitest";
import { crearCaso, editarCaso, cerrarCaso, listarCasosFinanzas, obtenerCaso } from "@/domains/finanzas/casos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import { repositorioAvisosEnMemoria } from "../dobles/repositorio-avisos-memoria";
import { puertoAvisos } from "@/domains/avisos/cola";

const base = {
  titulo: "Luna — cirugía de cadera",
  situacion: "La atropellaron en Provincias Unidas. Tiene fractura de pelvis y necesita cirugía.",
  metaCentavos: 50000000n,
};

function contexto(rol: "ADMINISTRACION" | "FINANZAS" | "ANIMALES" | "REDACCION" = "FINANZAS") {
  return {
    usuarioEmail: "carla@huellas.org.ar",
    rol,
    repositorio: repositorioFinanzasEnMemoria(),
    auditoria: auditoriaEnMemoria(),
    avisos: puertoAvisos(repositorioAvisosEnMemoria()),
  };
}

describe("crearCaso", () => {
  it("nace abierto y sin plata", async () => {
    const caso = await crearCaso(base, contexto());
    expect(caso.estado).toBe("ABIERTO");
    expect(caso.recibidoCentavos).toBe(0n);
    expect(caso.gastadoCentavos).toBe(0n);
  });

  it("le asigna una dirección permanente a partir del título", async () => {
    const caso = await crearCaso(base, contexto());
    expect(caso.slug).toBe("luna-cirugia-de-cadera");
  });

  it("evita colisiones de dirección", async () => {
    const ctx = contexto();
    await crearCaso(base, ctx);
    const segundo = await crearCaso(base, ctx);
    expect(segundo.slug).toBe("luna-cirugia-de-cadera-2");
  });

  it("rechaza una meta de cero o negativa", async () => {
    await expect(crearCaso({ ...base, metaCentavos: 0n }, contexto())).rejects.toThrow(/mayor que cero/i);
  });

  it("rechaza una situación demasiado corta para explicar el caso", async () => {
    await expect(crearCaso({ ...base, situacion: "se lastimó" }, contexto())).rejects.toThrow(/qué le pasó/i);
  });

  it("el rol de animales no puede crear casos: no escribe dinero", async () => {
    await expect(crearCaso(base, contexto("ANIMALES"))).rejects.toThrow(/permiso/i);
  });

  it("deja rastro en auditoría", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas.at(-1)).toMatchObject({ accion: "caso.crear", entidadId: caso.id });
  });
});

describe("editarCaso", () => {
  it("la dirección permanente no cambia al corregir el título", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const editado = await editarCaso(caso.id, { titulo: "Luna — cirugía de cadera y rehabilitación" }, ctx);
    expect(editado.slug).toBe("luna-cirugia-de-cadera");
  });

  it("la meta se puede corregir: es un objetivo, no un hecho contable", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const editado = await editarCaso(caso.id, { metaCentavos: 62000000n }, ctx);
    expect(editado.metaCentavos).toBe(62000000n);
  });

  it("ignora cualquier intento de escribir los saldos", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const editado = await editarCaso(caso.id, { recibidoCentavos: 99999999n } as never, ctx);
    expect(editado.recibidoCentavos).toBe(0n);
  });
});

describe("cerrarCaso", () => {
  it("un caso cerrado sigue existiendo y conserva su dirección", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const cerrado = await cerrarCaso(caso.id, ctx);
    expect(cerrado.estado).toBe("CERRADO");
    expect(await ctx.repositorio.casoPorSlug(caso.slug)).not.toBeNull();
  });
});

describe("listarCasosFinanzas", () => {
  it("devuelve los casos para el panel, sin filtrar por publicación", async () => {
    const ctx = contexto();
    await crearCaso(base, ctx);
    const casos = await listarCasosFinanzas({}, ctx);
    expect(casos).toHaveLength(1);
  });
});

describe("obtenerCaso", () => {
  it("devuelve el caso por id", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    expect((await obtenerCaso(caso.id, ctx)).titulo).toBe(base.titulo);
  });

  it("avisa si el caso no existe", async () => {
    await expect(obtenerCaso("no-existe", contexto())).rejects.toThrow(/no existe/i);
  });
});
