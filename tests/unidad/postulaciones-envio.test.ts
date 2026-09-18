import { describe, it, expect } from "vitest";
import { enviarPostulacion } from "@/domains/postulaciones/envio";
import { crearPregunta } from "@/domains/postulaciones/preguntas";
import { repositorioPostulacionesEnMemoria } from "../dobles/repositorio-postulaciones-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import { repositorioAvisosEnMemoria } from "../dobles/repositorio-avisos-memoria";
import { puertoAvisos } from "@/domains/avisos/cola";

async function escenario() {
  const repositorio = repositorioPostulacionesEnMemoria();
  const auditoria = auditoriaEnMemoria();
  const repositorioDeAvisos = repositorioAvisosEnMemoria();
  const avisos = puertoAvisos(repositorioDeAvisos);
  const ctx = { usuarioEmail: "marina@huellas.org.ar", rol: "ANIMALES" as const, repositorio, auditoria, avisos };

  const patio = await crearPregunta({ texto: "¿Tenés patio cerrado?", tipo: "SI_NO", obligatoria: true }, ctx);
  const porque = await crearPregunta({ texto: "¿Por qué querés adoptarlo?", tipo: "TEXTO_LARGO" }, ctx);

  return { repositorio, auditoria, avisos, repositorioDeAvisos, patio, porque };
}

const contacto = {
  animalId: "animal-1",
  nombreAnimal: "Rocky",
  nombre: "Marina Gómez",
  email: "marina@ejemplo.org",
  telefono: "341 555 0000",
};

describe("enviarPostulacion", () => {
  it("guarda la postulación con sus respuestas, en orden", async () => {
    const e = await escenario();
    const { postulacion } = await enviarPostulacion(
      { ...contacto, respuestas: { [e.patio.id]: "sí", [e.porque.id]: "Porque me encantó." } },
      e.repositorio,
      e.auditoria,
      e.avisos
    );

    expect(postulacion.estado).toBe("NUEVA");
    const respuestas = await e.repositorio.respuestasDe(postulacion.id);
    expect(respuestas.map((r) => r.valor)).toEqual(["sí", "Porque me encantó."]);
  });

  it("cada respuesta guarda el texto de la pregunta tal como se hizo", async () => {
    const e = await escenario();
    const { postulacion } = await enviarPostulacion(
      { ...contacto, respuestas: { [e.patio.id]: "sí" } },
      e.repositorio,
      e.auditoria,
      e.avisos
    );

    const respuestas = await e.repositorio.respuestasDe(postulacion.id);
    expect(respuestas[0].textoPregunta).toBe("¿Tenés patio cerrado?");
    expect(respuestas[0].tipo).toBe("SI_NO");
  });

  it("rechaza si falta una obligatoria", async () => {
    const e = await escenario();
    await expect(
      enviarPostulacion({ ...contacto, respuestas: { [e.porque.id]: "Solo esta" } }, e.repositorio, e.auditoria, e.avisos)
    ).rejects.toThrow(/obligatoria|completá/i);
  });

  it("rechaza un valor que no corresponde al tipo", async () => {
    const e = await escenario();
    await expect(
      enviarPostulacion({ ...contacto, respuestas: { [e.patio.id]: "más o menos" } }, e.repositorio, e.auditoria, e.avisos)
    ).rejects.toThrow(/sí o no/i);
  });

  it("rechaza un contacto incompleto", async () => {
    const e = await escenario();
    await expect(
      enviarPostulacion(
        { ...contacto, email: "no-es-un-correo", respuestas: { [e.patio.id]: "sí" } },
        e.repositorio,
        e.auditoria,
        e.avisos
      )
    ).rejects.toThrow(/correo/i);
  });

  it("ignora respuestas a preguntas que no están en el formulario", async () => {
    const e = await escenario();
    const { postulacion } = await enviarPostulacion(
      { ...contacto, respuestas: { [e.patio.id]: "sí", "pregunta-inventada": "cualquier cosa" } },
      e.repositorio,
      e.auditoria,
      e.avisos
    );
    const respuestas = await e.repositorio.respuestasDe(postulacion.id);
    expect(respuestas).toHaveLength(1);
  });

  it("deja rastro en auditoría sin copiar los datos personales", async () => {
    const e = await escenario();
    const { postulacion } = await enviarPostulacion(
      { ...contacto, respuestas: { [e.patio.id]: "sí" } },
      e.repositorio,
      e.auditoria,
      e.avisos
    );
    const entrada = (e.auditoria as ReturnType<typeof auditoriaEnMemoria>).entradas.at(-1)!;
    expect(entrada).toMatchObject({ accion: "postulacion.enviar", entidadId: postulacion.id });
    // La bitácora no es lugar para guardar una segunda copia del contacto.
    expect(JSON.stringify(entrada)).not.toContain("marina@ejemplo.org");
  });
});

describe("control de envío repetido", () => {
  it("un segundo envío igual devuelve la misma postulación", async () => {
    const e = await escenario();
    const datos = { ...contacto, respuestas: { [e.patio.id]: "sí" } };

    const primero = await enviarPostulacion(datos, e.repositorio, e.auditoria, e.avisos);
    const segundo = await enviarPostulacion(datos, e.repositorio, e.auditoria, e.avisos);

    expect(segundo.postulacion.id).toBe(primero.postulacion.id);
    expect(segundo.repetida).toBe(true);
    expect(e.repositorio.postulaciones).toHaveLength(1);
  });

  it("el mismo correo para otro animal sí crea una postulación nueva", async () => {
    const e = await escenario();
    await enviarPostulacion({ ...contacto, respuestas: { [e.patio.id]: "sí" } }, e.repositorio, e.auditoria, e.avisos);
    const otra = await enviarPostulacion(
      { ...contacto, animalId: "animal-2", respuestas: { [e.patio.id]: "sí" } },
      e.repositorio,
      e.auditoria,
      e.avisos
    );
    expect(otra.repetida).toBe(false);
    expect(e.repositorio.postulaciones).toHaveLength(2);
  });
});
