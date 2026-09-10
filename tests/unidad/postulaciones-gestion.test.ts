import { describe, it, expect } from "vitest";
import { cambiarEstado, borrarDatosPersonales, cerrarOtrasPostulaciones } from "@/domains/postulaciones/gestion";
import { enviarPostulacion } from "@/domains/postulaciones/envio";
import { crearPregunta } from "@/domains/postulaciones/preguntas";
import { repositorioPostulacionesEnMemoria } from "../dobles/repositorio-postulaciones-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import type { Rol } from "@/domains/postulaciones/tipos";

async function escenario(rol: Rol = "ANIMALES") {
  const repositorio = repositorioPostulacionesEnMemoria();
  const auditoria = auditoriaEnMemoria();
  const ctx = { usuarioEmail: "marina@huellas.org.ar", rol, repositorio, auditoria };

  const patio = await crearPregunta(
    { texto: "¿Tenés patio cerrado?", tipo: "SI_NO" },
    { ...ctx, rol: "ANIMALES" as const }
  );

  const { postulacion } = await enviarPostulacion(
    { animalId: "animal-1", nombre: "Marina Gómez", email: "marina@ejemplo.org", telefono: "341 555 0000", respuestas: { [patio.id]: "sí" } },
    repositorio,
    auditoria
  );

  return { ctx, repositorio, auditoria, postulacion };
}

describe("cambiarEstado", () => {
  it("cambia el estado y guarda el comentario en la auditoría", async () => {
    const e = await escenario();
    const actualizada = await cambiarEstado(e.postulacion.id, "CONTACTADA", "La llamé, quedamos en hablar el jueves", e.ctx);

    expect(actualizada.estado).toBe("CONTACTADA");
    const entrada = (e.auditoria as ReturnType<typeof auditoriaEnMemoria>).entradas.at(-1)!;
    expect(entrada.accion).toBe("postulacion.cambiarEstado");
    expect(JSON.stringify(entrada.valorNuevo)).toContain("jueves");
  });

  it("el comentario es opcional", async () => {
    const e = await escenario();
    const actualizada = await cambiarEstado(e.postulacion.id, "EN_REVISION", null, e.ctx);
    expect(actualizada.estado).toBe("EN_REVISION");
  });

  it("el rol de finanzas no puede cambiar estados", async () => {
    const e = await escenario("FINANZAS");
    await expect(cambiarEstado(e.postulacion.id, "EN_REVISION", null, e.ctx)).rejects.toThrow(/permiso/i);
  });

  it("aprobar una postulación NO cambia el estado del animal", async () => {
    const e = await escenario();
    await cambiarEstado(e.postulacion.id, "APROBADA", null, e.ctx);
    const acciones = (e.auditoria as ReturnType<typeof auditoriaEnMemoria>).entradas.map((x) => x.accion);
    // Nada que toque al animal: el panel lo ofrece, el dominio no lo hace.
    expect(acciones.some((a) => a.startsWith("animal."))).toBe(false);
  });
});

describe("borrarDatosPersonales", () => {
  it("limpia contacto y respuestas, y conserva el caparazón", async () => {
    const e = await escenario();
    const anonimizada = await borrarDatosPersonales(e.postulacion.id, e.ctx);

    expect(anonimizada.nombre).toBe("");
    expect(anonimizada.email).toBe("");
    expect(anonimizada.telefono).toBe("");
    expect(anonimizada.anonimizadaEn).toBeInstanceOf(Date);
    // El caparazón queda: a qué animal, cuándo, en qué estado terminó.
    expect(anonimizada.animalId).toBe("animal-1");
    expect(anonimizada.estado).toBe("NUEVA");

    const respuestas = await e.repositorio.respuestasDe(e.postulacion.id);
    expect(respuestas.every((r) => r.valor === "")).toBe(true);
    // El texto de la pregunta no es dato personal: se conserva.
    expect(respuestas[0].textoPregunta).toBe("¿Tenés patio cerrado?");
  });

  it("queda auditado con quién lo hizo", async () => {
    const e = await escenario();
    await borrarDatosPersonales(e.postulacion.id, e.ctx);
    const entrada = (e.auditoria as ReturnType<typeof auditoriaEnMemoria>).entradas.at(-1)!;
    expect(entrada).toMatchObject({ accion: "postulacion.borrarDatosPersonales", usuarioEmail: "marina@huellas.org.ar" });
  });

  it("una postulación anonimizada queda de solo lectura", async () => {
    const e = await escenario();
    await borrarDatosPersonales(e.postulacion.id, e.ctx);
    await expect(cambiarEstado(e.postulacion.id, "APROBADA", null, e.ctx)).rejects.toThrow(/anonimizada|solo lectura/i);
  });

  it("no se puede borrar dos veces", async () => {
    const e = await escenario();
    await borrarDatosPersonales(e.postulacion.id, e.ctx);
    await expect(borrarDatosPersonales(e.postulacion.id, e.ctx)).rejects.toThrow(/ya .*borrado|anonimizada/i);
  });
});

describe("cerrarOtrasPostulaciones", () => {
  it("rechaza las demás del mismo animal y deja la elegida", async () => {
    const e = await escenario();
    const otra = await enviarPostulacion(
      { animalId: "animal-1", nombre: "Otra persona", email: "otra@ejemplo.org", telefono: "341 555 1111", respuestas: {} },
      e.repositorio,
      e.auditoria
    );

    const cerradas = await cerrarOtrasPostulaciones("animal-1", e.postulacion.id, e.ctx);

    expect(cerradas).toBe(1);
    expect((await e.repositorio.postulacionPorId(otra.postulacion.id))!.estado).toBe("RECHAZADA");
    expect((await e.repositorio.postulacionPorId(e.postulacion.id))!.estado).toBe("NUEVA");
  });

  it("no toca las de otros animales", async () => {
    const e = await escenario();
    const deOtroAnimal = await enviarPostulacion(
      { animalId: "animal-2", nombre: "Tercera", email: "tercera@ejemplo.org", telefono: "341 555 2222", respuestas: {} },
      e.repositorio,
      e.auditoria
    );

    await cerrarOtrasPostulaciones("animal-1", e.postulacion.id, e.ctx);
    expect((await e.repositorio.postulacionPorId(deOtroAnimal.postulacion.id))!.estado).toBe("NUEVA");
  });
});
