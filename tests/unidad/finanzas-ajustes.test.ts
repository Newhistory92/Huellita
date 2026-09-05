import { describe, it, expect } from "vitest";
import { registrarAjuste, trasladarEntreCasos } from "@/domains/finanzas/ajustes";
import { registrarAsiento } from "@/domains/finanzas/asientos";
import { crearCaso } from "@/domains/finanzas/casos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

function contexto(rol: "ADMINISTRACION" | "FINANZAS" | "REDACCION" = "FINANZAS") {
  return { usuarioEmail: "carla@huellas.org.ar", rol, repositorio: repositorioFinanzasEnMemoria(), auditoria: auditoriaEnMemoria() };
}

async function dosCasosConPlata() {
  const ctx = contexto();
  const rocky = await crearCaso({ titulo: "Rocky — fractura de fémur", situacion: "Lo atropellaron y necesita cirugía traumatológica urgente.", metaCentavos: 50000000n }, ctx);
  const max = await crearCaso({ titulo: "Max — tratamiento veterinario", situacion: "Necesita tratamiento prolongado por una infección severa.", metaCentavos: 30000000n }, ctx);
  await registrarAsiento({ casoId: rocky.id, tipo: "DONACION", centavos: 62000000n, descripcion: "Donaciones", fechaEfectiva: new Date() }, ctx);
  return { ctx, rocky, max };
}

describe("registrarAjuste", () => {
  it("crea un asiento nuevo en vez de tocar el original", async () => {
    const ctx = contexto();
    const caso = await crearCaso({ titulo: "Luna — cirugía", situacion: "La atropellaron y necesita cirugía de cadera urgente.", metaCentavos: 50000000n }, ctx);
    const original = await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 2500000n, descripcion: "Donación", fechaEfectiva: new Date(), proveedor: "mercadopago", pagoExternoId: "1327884391" }, ctx);

    const ajuste = await registrarAjuste(
      { casoId: caso.id, centavos: -2500000n, ajustaAId: original.id, motivo: "Contracargo del pago 1327884391", documentoId: "doc-contracargo" },
      ctx
    );

    expect(ajuste.tipo).toBe("AJUSTE");
    expect(ajuste.ajustaAId).toBe(original.id);
    // El original sigue intacto en el libro.
    const asientos = await ctx.repositorio.asientosDeCaso(caso.id);
    expect(asientos).toHaveLength(2);
    expect(asientos[0].centavos).toBe(2500000n);
    // Y el saldo refleja las dos líneas.
    expect((await ctx.repositorio.casoPorId(caso.id))!.recibidoCentavos).toBe(2500000n);
    expect((await ctx.repositorio.casoPorId(caso.id))!.gastadoCentavos).toBe(2500000n);
  });

  it("exige motivo: el ajuste queda publicado", async () => {
    const ctx = contexto();
    const caso = await crearCaso({ titulo: "Luna", situacion: "La atropellaron y necesita cirugía de cadera urgente.", metaCentavos: 50000000n }, ctx);
    const original = await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000n, descripcion: "x", fechaEfectiva: new Date() }, ctx);
    await expect(
      registrarAjuste({ casoId: caso.id, centavos: -1000n, ajustaAId: original.id, motivo: "error", documentoId: "doc-1" }, ctx)
    ).rejects.toThrow(/motivo/i);
  });

  it("exige documentación de respaldo", async () => {
    const ctx = contexto();
    const caso = await crearCaso({ titulo: "Luna", situacion: "La atropellaron y necesita cirugía de cadera urgente.", metaCentavos: 50000000n }, ctx);
    const original = await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000n, descripcion: "x", fechaEfectiva: new Date() }, ctx);
    await expect(
      registrarAjuste({ casoId: caso.id, centavos: -1000n, ajustaAId: original.id, motivo: "Contracargo del pago informado por el banco", documentoId: "" }, ctx)
    ).rejects.toThrow(/respaldo/i);
  });
});

describe("trasladarEntreCasos", () => {
  it("deja las dos puntas, vinculadas", async () => {
    const { ctx, rocky, max } = await dosCasosConPlata();
    const { salida, entrada } = await trasladarEntreCasos(
      { origenId: rocky.id, destinoId: max.id, centavos: 12000000n, motivo: "Excedente de Rocky asignado por acta de comisión N.º 47" },
      ctx
    );

    expect(salida.centavos).toBe(-12000000n);
    expect(entrada.centavos).toBe(12000000n);

    // El vínculo se guarda de un solo lado, y no es una simplificación: los
    // asientos son inmutables, así que el segundo no puede volver atrás a
    // completar el primero. La salida se crea después y apunta a la entrada;
    // desde la entrada se llega por la relación inversa del esquema.
    expect(salida.contraparteId).toBe(entrada.id);
    expect(entrada.contraparteId).toBeNull();
  });

  it("el asiento de llegada se puede encontrar desde su contraparte", async () => {
    const { ctx, rocky, max } = await dosCasosConPlata();
    const { salida, entrada } = await trasladarEntreCasos(
      { origenId: rocky.id, destinoId: max.id, centavos: 12000000n, motivo: "Excedente de Rocky asignado por acta de comisión N.º 47" },
      ctx
    );

    const asientosDelDestino = await ctx.repositorio.asientosDeCaso(max.id);
    const llegada = asientosDelDestino.find((a) => a.id === entrada.id);
    expect(llegada).toBeDefined();

    const asientosDelOrigen = await ctx.repositorio.asientosDeCaso(rocky.id);
    expect(asientosDelOrigen.find((a) => a.contraparteId === llegada!.id)?.id).toBe(salida.id);
  });

  it("mueve el saldo de los dos casos", async () => {
    const { ctx, rocky, max } = await dosCasosConPlata();
    await trasladarEntreCasos({ origenId: rocky.id, destinoId: max.id, centavos: 12000000n, motivo: "Excedente de Rocky asignado por acta de comisión N.º 47" }, ctx);
    expect((await ctx.repositorio.casoPorId(rocky.id))!.gastadoCentavos).toBe(12000000n);
    expect((await ctx.repositorio.casoPorId(max.id))!.recibidoCentavos).toBe(12000000n);
  });

  it("no traslada más de lo disponible", async () => {
    const { ctx, rocky, max } = await dosCasosConPlata();
    await expect(
      trasladarEntreCasos({ origenId: rocky.id, destinoId: max.id, centavos: 99000000n, motivo: "Excedente de Rocky asignado por acta de comisión N.º 47" }, ctx)
    ).rejects.toThrow(/disponible/i);
  });

  it("no traslada un caso a sí mismo", async () => {
    const { ctx, rocky } = await dosCasosConPlata();
    await expect(
      trasladarEntreCasos({ origenId: rocky.id, destinoId: rocky.id, centavos: 1000n, motivo: "Excedente de Rocky asignado por acta de comisión N.º 47" }, ctx)
    ).rejects.toThrow(/mismo caso/i);
  });

  it("exige motivo", async () => {
    const { ctx, rocky, max } = await dosCasosConPlata();
    await expect(
      trasladarEntreCasos({ origenId: rocky.id, destinoId: max.id, centavos: 1000n, motivo: "porque sí" }, ctx)
    ).rejects.toThrow(/motivo/i);
  });
});
