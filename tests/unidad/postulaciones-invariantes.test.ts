import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { cambiarEstado, borrarDatosPersonales } from "@/domains/postulaciones/gestion";
import { crearPregunta } from "@/domains/postulaciones/preguntas";
import { enviarPostulacion } from "@/domains/postulaciones/envio";
import { repositorioPostulacionesEnMemoria } from "../dobles/repositorio-postulaciones-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

function archivosDe(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => path.join(dir, f));
}

describe("invariantes de la entrega 3", () => {
  it("ninguna página importa el repositorio de postulaciones directamente", () => {
    const infractores = archivosDe("src/app")
      .filter((f) => !f.includes("acciones"))
      .filter((f) => /repositorios\/postulaciones/.test(readFileSync(f, "utf8")));
    expect(infractores, `saltean la capa de dominio: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("las postulaciones no entran al mapa del sitio", () => {
    const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
    expect(sitemap).not.toMatch(/postulacion/i);
  });

  it("no existe ninguna página pública que muestre una postulación", () => {
    const publicas = archivosDe("src/app").filter(
      (f) => !f.includes("panel") && f.endsWith("page.tsx")
    );
    const infractores = publicas.filter((f) => /detalleDePostulacion|postulacionesDelPanel/.test(readFileSync(f, "utf8")));
    expect(infractores, `exponen postulaciones sin sesión: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("el rol de finanzas no puede leer ni escribir postulaciones", async () => {
    const repositorio = repositorioPostulacionesEnMemoria();
    const auditoria = auditoriaEnMemoria();
    const ctxAnimales = { usuarioEmail: "a@b.c", rol: "ANIMALES" as const, repositorio, auditoria };

    const { postulacion } = await enviarPostulacion(
      { animalId: "animal-1", nombre: "Marina", email: "marina@ejemplo.org", telefono: "341 555 0000", respuestas: {} },
      repositorio,
      auditoria
    );

    const ctxFinanzas = { ...ctxAnimales, rol: "FINANZAS" as const };
    await expect(cambiarEstado(postulacion.id, "APROBADA", null, ctxFinanzas)).rejects.toThrow(/permiso/i);
    await expect(borrarDatosPersonales(postulacion.id, ctxFinanzas)).rejects.toThrow(/permiso/i);
    await expect(crearPregunta({ texto: "x", tipo: "SI_NO" }, ctxFinanzas)).rejects.toThrow(/permiso/i);
  });

  it("borrar los datos personales no deja rastro del contacto", async () => {
    const repositorio = repositorioPostulacionesEnMemoria();
    const auditoria = auditoriaEnMemoria();
    const ctx = { usuarioEmail: "a@b.c", rol: "ANIMALES" as const, repositorio, auditoria };

    const pregunta = await crearPregunta({ texto: "¿Tenés patio?", tipo: "SI_NO" }, ctx);
    const { postulacion } = await enviarPostulacion(
      { animalId: "animal-1", nombre: "Marina Gómez", email: "marina@ejemplo.org", telefono: "341 555 0000", respuestas: { [pregunta.id]: "sí" } },
      repositorio,
      auditoria
    );

    await borrarDatosPersonales(postulacion.id, ctx);

    // Ni en la postulación, ni en las respuestas, ni en la bitácora.
    const todo = JSON.stringify({
      postulaciones: repositorio.postulaciones,
      respuestas: repositorio.respuestas,
      auditoria: (auditoria as ReturnType<typeof auditoriaEnMemoria>).entradas,
    });
    expect(todo).not.toContain("marina@ejemplo.org");
    expect(todo).not.toContain("Marina Gómez");
    expect(todo).not.toContain("341 555 0000");
  });

  it("ninguna acción se inventa un rol para conformar al tipo", () => {
    // Escribir `rol: ... as "ADMINISTRACION"` saltea la verificación de
    // permisos: el dominio verifica sobre lo que recibe, y recibiría una
    // mentira. El rol tiene que viajar tal como vino de la sesión.
    const infractores = archivosDe("src/app")
      .filter((f) => /rol:\s*[^,]*as\s+"(ADMINISTRACION|ANIMALES|FINANZAS|REDACCION)"/.test(readFileSync(f, "utf8")));
    expect(infractores, `se inventan un rol: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("el dominio de postulaciones no importa el de animales", () => {
    const infractores = archivosDe("src/domains/postulaciones").filter((f) =>
      /from "@\/domains\/animales\/servicio"/.test(readFileSync(f, "utf8"))
    );
    expect(
      infractores,
      `cambiar el estado del animal es decisión del panel, no del dominio: ${infractores.join(", ")}`
    ).toHaveLength(0);
  });
});
