import { describe, it, expect } from "vitest";
import { vaciarCola, MAX_INTENTOS } from "@/domains/avisos/cola";
import { repositorioAvisosEnMemoria } from "../dobles/repositorio-avisos-memoria";
import { proveedorCorreoFalso } from "../dobles/proveedor-correo-falso";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import type { Rol } from "@/domains/avisos/tipos";

const URL_BASE = "https://refugiohuellas.org.ar";

function escenario(
  correosPorRol: Partial<Record<Rol, string[]>> = {
    ANIMALES: ["marina@huellas.org.ar"],
    FINANZAS: ["carla@huellas.org.ar"],
    ADMINISTRACION: ["admin@huellas.org.ar"],
  }
) {
  const repositorio = repositorioAvisosEnMemoria(correosPorRol);
  const correo = proveedorCorreoFalso();
  const auditoria = auditoriaEnMemoria();
  return { repositorio, correo, auditoria, ctx: { repositorio, correo, auditoria } };
}

describe("vaciarCola", () => {
  it("sin pendientes no manda nada", async () => {
    const e = escenario();
    const resumen = await vaciarCola(e.ctx, URL_BASE);
    expect(resumen.enviados).toBe(0);
    expect(e.correo.enviados).toHaveLength(0);
  });

  it("manda un correo a cada destinatario que corresponde", async () => {
    const e = escenario();
    await e.repositorio.anotar({ tipo: "POSTULACION_NUEVA", datos: { nombreAnimal: "Juanito" } });

    await vaciarCola(e.ctx, URL_BASE);

    // Animales y administración, no finanzas.
    const destinatarios = e.correo.enviados.flatMap((c) => c.para).sort();
    expect(destinatarios).toEqual(["admin@huellas.org.ar", "marina@huellas.org.ar"]);
  });

  it("agrupa: veinte donaciones son un correo por persona, no veinte", async () => {
    const e = escenario();
    for (let i = 0; i < 20; i++) {
      await e.repositorio.anotar({ tipo: "DONACION_VERIFICADA", datos: { tituloCaso: "Luna — cirugía", montoTexto: "$1.000" } });
    }

    await vaciarCola(e.ctx, URL_BASE);

    // Dos personas reciben finanzas: carla y admin. Un correo cada una.
    expect(e.correo.enviados).toHaveLength(2);
    expect(e.correo.enviados[0].asunto).toContain("20");
  });

  it("no le avisa a quien hizo la acción", async () => {
    const e = escenario();
    await e.repositorio.anotar({
      tipo: "TRANSFERENCIA_PENDIENTE",
      datos: { tituloCaso: "Luna — cirugía" },
      originadoPorEmail: "carla@huellas.org.ar",
    });

    await vaciarCola(e.ctx, URL_BASE);

    const destinatarios = e.correo.enviados.flatMap((c) => c.para);
    expect(destinatarios).not.toContain("carla@huellas.org.ar");
    expect(destinatarios).toContain("admin@huellas.org.ar");
  });

  it("marca los enviados: vaciar dos veces no manda dos veces", async () => {
    const e = escenario();
    await e.repositorio.anotar({ tipo: "POSTULACION_NUEVA", datos: { nombreAnimal: "Juanito" } });

    await vaciarCola(e.ctx, URL_BASE);
    const despuesDeLaPrimera = e.correo.enviados.length;
    await vaciarCola(e.ctx, URL_BASE);

    expect(e.correo.enviados).toHaveLength(despuesDeLaPrimera);
  });

  it("si el envío falla, el aviso sigue pendiente y suma un intento", async () => {
    const repositorio = repositorioAvisosEnMemoria({ ANIMALES: ["marina@huellas.org.ar"] });
    const correo = proveedorCorreoFalso({ falla: true });
    const ctx = { repositorio, correo, auditoria: auditoriaEnMemoria() };
    await repositorio.anotar({ tipo: "POSTULACION_NUEVA", datos: { nombreAnimal: "Juanito" } });

    const resumen = await vaciarCola(ctx, URL_BASE);

    expect(resumen.fallidos).toBe(1);
    expect(repositorio.avisos[0].enviadoEn).toBeNull();
    expect(repositorio.avisos[0].intentos).toBe(1);
    expect(repositorio.avisos[0].ultimoError).toContain("no responde");
  });

  it("después de agotar los intentos deja de tomarlo", async () => {
    const repositorio = repositorioAvisosEnMemoria({ ANIMALES: ["marina@huellas.org.ar"] });
    const correo = proveedorCorreoFalso({ falla: true });
    const ctx = { repositorio, correo, auditoria: auditoriaEnMemoria() };
    await repositorio.anotar({ tipo: "POSTULACION_NUEVA", datos: { nombreAnimal: "Juanito" } });

    for (let i = 0; i < MAX_INTENTOS + 2; i++) await vaciarCola(ctx, URL_BASE);

    expect(repositorio.avisos[0].intentos).toBe(MAX_INTENTOS);
  });

  it("un aviso sin destinatarios se marca enviado y no queda trabado", async () => {
    // Nadie tiene el rol que recibe: si no se marcara, se reintentaría para siempre.
    const e = escenario({ FINANZAS: [], ADMINISTRACION: [] });
    await e.repositorio.anotar({ tipo: "DONACION_VERIFICADA", datos: { tituloCaso: "Luna" } });

    await vaciarCola(e.ctx, URL_BASE);

    expect(e.repositorio.avisos[0].enviadoEn).not.toBeNull();
    expect(e.correo.enviados).toHaveLength(0);
  });
});
