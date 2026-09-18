import { describe, it, expect } from "vitest";
import { verificarSaldos } from "@/domains/finanzas/verificacion";
import { crearCaso } from "@/domains/finanzas/casos";
import { registrarAsiento } from "@/domains/finanzas/asientos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import { repositorioAvisosEnMemoria } from "../dobles/repositorio-avisos-memoria";
import { puertoAvisos } from "@/domains/avisos/cola";

const base = { titulo: "Luna", situacion: "La atropellaron y necesita cirugía de cadera urgente.", metaCentavos: 50000000n };

describe("verificarSaldos", () => {
  it("no informa diferencias cuando todo cuadra", async () => {
    const ctx = {
      usuarioEmail: "c@h.org",
      rol: "FINANZAS" as const,
      repositorio: repositorioFinanzasEnMemoria(),
      auditoria: auditoriaEnMemoria(),
      avisos: puertoAvisos(repositorioAvisosEnMemoria()),
    };
    const caso = await crearCaso(base, ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000000n, descripcion: "x", fechaEfectiva: new Date() }, ctx);
    expect(await verificarSaldos(ctx.repositorio)).toEqual([]);
  });

  it("detecta un saldo tocado por fuera del sistema", async () => {
    const ctx = {
      usuarioEmail: "c@h.org",
      rol: "FINANZAS" as const,
      repositorio: repositorioFinanzasEnMemoria(),
      auditoria: auditoriaEnMemoria(),
      avisos: puertoAvisos(repositorioAvisosEnMemoria()),
    };
    const caso = await crearCaso(base, ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000000n, descripcion: "x", fechaEfectiva: new Date() }, ctx);

    // Alguien escribió directo en la base, salteando el dominio.
    await ctx.repositorio.actualizarCaso(caso.id, { recibidoCentavos: 99999999n });

    const diferencias = await verificarSaldos(ctx.repositorio);
    expect(diferencias).toHaveLength(1);
    expect(diferencias[0]).toMatchObject({ casoId: caso.id, guardadoRecibido: 99999999n, calculadoRecibido: 1000000n });
  });
});
