import { describe, it, expect } from "vitest";
import { crearCaso } from "@/domains/finanzas/casos";
import { registrarAsiento, registrarGasto } from "@/domains/finanzas/asientos";
import { declararTransferencia, verificarTransferencia } from "@/domains/finanzas/donaciones";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { repositorioAvisosEnMemoria } from "../dobles/repositorio-avisos-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import { puertoAvisos } from "@/domains/avisos/cola";

const base = {
  titulo: "Luna — cirugía",
  situacion: "La atropellaron en Provincias Unidas y necesita cirugía de cadera.",
  metaCentavos: 50000000n,
};

function escenario() {
  const repositorioDeAvisos = repositorioAvisosEnMemoria();
  const ctx = {
    usuarioEmail: "carla@huellas.org.ar",
    rol: "FINANZAS" as const,
    repositorio: repositorioFinanzasEnMemoria(),
    auditoria: auditoriaEnMemoria(),
    avisos: puertoAvisos(repositorioDeAvisos),
  };
  return { ctx, repositorioDeAvisos };
}

describe("qué anota un aviso y qué no", () => {
  it("alcanzar la meta anota un aviso", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    await registrarAsiento(
      { casoId: caso.id, tipo: "DONACION", centavos: 62000000n, descripcion: "Grande", fechaEfectiva: new Date() },
      e.ctx
    );

    const tipos = e.repositorioDeAvisos.avisos.map((a) => a.tipo);
    expect(tipos).toContain("META_ALCANZADA");
  });

  it("no vuelve a anotarlo si ya estaba en meta alcanzada", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 62000000n, descripcion: "A", fechaEfectiva: new Date() }, e.ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000000n, descripcion: "B", fechaEfectiva: new Date() }, e.ctx);

    const alcanzadas = e.repositorioDeAvisos.avisos.filter((a) => a.tipo === "META_ALCANZADA");
    expect(alcanzadas).toHaveLength(1);
  });

  it("declarar una transferencia anota un aviso", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    await declararTransferencia(
      { casoId: caso.id, centavos: 1000000n, nombreDonante: null, publicarNombre: false, comprobanteId: null },
      e.ctx.repositorio,
      e.ctx.avisos
    );

    expect(e.repositorioDeAvisos.avisos.map((a) => a.tipo)).toContain("TRANSFERENCIA_PENDIENTE");
  });

  // El criterio de la §5.2: lo que hace una persona del equipo no avisa.
  it("registrar un gasto NO anota ningún aviso", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    await registrarGasto(
      { casoId: caso.id, centavos: 100000n, descripcion: "Estudios", documentoId: null, fechaEfectiva: new Date() },
      e.ctx
    );

    expect(e.repositorioDeAvisos.avisos).toHaveLength(0);
  });

  it("verificar una transferencia NO anota DONACION_VERIFICADA", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    const intencion = await declararTransferencia(
      { casoId: caso.id, centavos: 1000000n, nombreDonante: null, publicarNombre: false, comprobanteId: null },
      e.ctx.repositorio,
      e.ctx.avisos
    );

    await verificarTransferencia(intencion.id, e.ctx);

    // La declaró de afuera: eso sí avisó. Verificarla la hizo Carla, que ya sabe.
    const tipos = e.repositorioDeAvisos.avisos.map((a) => a.tipo);
    expect(tipos).toContain("TRANSFERENCIA_PENDIENTE");
    expect(tipos).not.toContain("DONACION_VERIFICADA");
  });

  it("el aviso guarda quién originó la acción", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    await registrarAsiento(
      { casoId: caso.id, tipo: "DONACION", centavos: 62000000n, descripcion: "Grande", fechaEfectiva: new Date() },
      e.ctx
    );

    const aviso = e.repositorioDeAvisos.avisos.find((a) => a.tipo === "META_ALCANZADA")!;
    expect(aviso.originadoPorEmail).toBe("carla@huellas.org.ar");
  });
});
