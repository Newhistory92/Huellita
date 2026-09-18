import { describe, it, expect } from "vitest";
import { registrarAsiento, registrarGasto } from "@/domains/finanzas/asientos";
import { crearCaso } from "@/domains/finanzas/casos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import { repositorioAvisosEnMemoria } from "../dobles/repositorio-avisos-memoria";
import { puertoAvisos } from "@/domains/avisos/cola";

const base = {
  titulo: "Luna — cirugía",
  situacion: "La atropellaron en Provincias Unidas y necesita cirugía de cadera.",
  metaCentavos: 50000000n, // $500.000
};

function contexto(rol: "ADMINISTRACION" | "FINANZAS" | "REDACCION" = "FINANZAS") {
  return {
    usuarioEmail: "carla@huellas.org.ar",
    rol,
    repositorio: repositorioFinanzasEnMemoria(),
    auditoria: auditoriaEnMemoria(),
    avisos: puertoAvisos(repositorioAvisosEnMemoria()),
  };
}

async function casoConContexto() {
  const ctx = contexto();
  const caso = await crearCaso(base, ctx);
  return { ctx, caso };
}

describe("registrarAsiento", () => {
  it("una donación mueve el recibido del caso", async () => {
    const { ctx, caso } = await casoConContexto();
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 2500000n, descripcion: "Donación", fechaEfectiva: new Date() }, ctx);
    const actualizado = await ctx.repositorio.casoPorId(caso.id);
    expect(actualizado!.recibidoCentavos).toBe(2500000n);
    expect(actualizado!.gastadoCentavos).toBe(0n);
    expect(actualizado!.cantidadDonantes).toBe(1);
  });

  it("el saldo sale de sumar los asientos, no de acumular a ciegas", async () => {
    const { ctx, caso } = await casoConContexto();
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 2500000n, descripcion: "Una", fechaEfectiva: new Date() }, ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000000n, descripcion: "Otra", fechaEfectiva: new Date() }, ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "GASTO", centavos: -800000n, descripcion: "Estudios", fechaEfectiva: new Date() }, ctx);

    const actualizado = await ctx.repositorio.casoPorId(caso.id);
    expect(actualizado!.recibidoCentavos).toBe(3500000n);
    expect(actualizado!.gastadoCentavos).toBe(800000n);
    expect(actualizado!.cantidadDonantes).toBe(2);
  });

  it("al superar la meta el caso queda en meta alcanzada, pero sigue abierto a donaciones", async () => {
    const { ctx, caso } = await casoConContexto();
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 62000000n, descripcion: "Grande", fechaEfectiva: new Date() }, ctx);
    const actualizado = await ctx.repositorio.casoPorId(caso.id);
    expect(actualizado!.estado).toBe("META_ALCANZADA");

    // Sigue aceptando: en una urgencia el presupuesto real supera al estimado.
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 500000n, descripcion: "Otra más", fechaEfectiva: new Date() }, ctx);
    expect((await ctx.repositorio.casoPorId(caso.id))!.recibidoCentavos).toBe(62500000n);
  });

  it("un caso cerrado no acepta movimientos nuevos", async () => {
    const { ctx, caso } = await casoConContexto();
    await ctx.repositorio.actualizarCaso(caso.id, { estado: "CERRADO" });
    await expect(
      registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000n, descripcion: "Tardía", fechaEfectiva: new Date() }, ctx)
    ).rejects.toThrow(/cerrado/i);
  });

  it("el mismo pago no puede generar dos asientos", async () => {
    const { ctx, caso } = await casoConContexto();
    const pago = { casoId: caso.id, tipo: "DONACION" as const, centavos: 1000000n, descripcion: "Donación", fechaEfectiva: new Date(), proveedor: "mercadopago", pagoExternoId: "1327884391" };
    await registrarAsiento(pago, ctx);
    await expect(registrarAsiento(pago, ctx)).rejects.toThrow();
    expect((await ctx.repositorio.casoPorId(caso.id))!.recibidoCentavos).toBe(1000000n);
  });

  it("el rol de redacción no puede registrar movimientos", async () => {
    const { caso } = await casoConContexto();
    const ctxRedaccion = contexto("REDACCION");
    await expect(
      registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000n, descripcion: "x", fechaEfectiva: new Date() }, ctxRedaccion)
    ).rejects.toThrow(/permiso/i);
  });

  it("deja rastro en auditoría con el importe", async () => {
    const { ctx, caso } = await casoConContexto();
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 2500000n, descripcion: "Donación", fechaEfectiva: new Date() }, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas.at(-1)).toMatchObject({ accion: "asiento.crear", entidad: "AsientoContable" });
  });
});

describe("registrarGasto", () => {
  it("guarda el importe en negativo aunque se cargue en positivo", async () => {
    const { ctx, caso } = await casoConContexto();
    const asiento = await registrarGasto({ casoId: caso.id, centavos: 6200000n, descripcion: "Estudios prequirúrgicos", documentoId: "doc-1", fechaEfectiva: new Date() }, ctx);
    expect(asiento.centavos).toBe(-6200000n);
    expect((await ctx.repositorio.casoPorId(caso.id))!.gastadoCentavos).toBe(6200000n);
  });

  it("un gasto sin comprobante se registra igual, pero queda marcado", async () => {
    const { ctx, caso } = await casoConContexto();
    const asiento = await registrarGasto({ casoId: caso.id, centavos: 100000n, descripcion: "Taxi a la veterinaria", documentoId: null, fechaEfectiva: new Date() }, ctx);
    expect(asiento.documentoId).toBeNull();
  });
});
