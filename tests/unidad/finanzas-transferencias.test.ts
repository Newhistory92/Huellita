import { describe, it, expect } from "vitest";
import { declararTransferencia, verificarTransferencia, rechazarTransferencia, totalPendienteDeVerificar } from "@/domains/finanzas/donaciones";
import { crearCaso } from "@/domains/finanzas/casos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

const base = {
  titulo: "Luna — cirugía",
  situacion: "La atropellaron en Provincias Unidas y necesita cirugía de cadera.",
  metaCentavos: 50000000n,
};

function contexto(rol: "ADMINISTRACION" | "FINANZAS" | "REDACCION" = "FINANZAS") {
  return { usuarioEmail: "carla@huellas.org.ar", rol, repositorio: repositorioFinanzasEnMemoria(), auditoria: auditoriaEnMemoria() };
}

async function casoConTransferencia() {
  const ctx = contexto();
  const caso = await crearCaso(base, ctx);
  const intencion = await declararTransferencia(
    { casoId: caso.id, centavos: 1000000n, nombreDonante: "Marina", publicarNombre: false, comprobanteId: "doc-1" },
    ctx.repositorio
  );
  return { ctx, caso, intencion };
}

describe("declararTransferencia", () => {
  it("queda pendiente de verificación, no aprobada", async () => {
    const { intencion } = await casoConTransferencia();
    expect(intencion.estado).toBe("PENDIENTE_VERIFICACION");
    expect(intencion.proveedor).toBe("transferencia");
  });

  it("lo pendiente NO suma al total público del caso", async () => {
    const { ctx, caso } = await casoConTransferencia();
    const actualizado = await ctx.repositorio.casoPorId(caso.id);
    expect(actualizado!.recibidoCentavos).toBe(0n);
  });

  it("el total pendiente se puede consultar aparte, para mostrarlo como pendiente", async () => {
    const { ctx, caso } = await casoConTransferencia();
    expect(await totalPendienteDeVerificar(caso.id, ctx.repositorio)).toBe(1000000n);
  });

  it("no exige sesión: la declara quien donó, desde el sitio público", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const intencion = await declararTransferencia(
      { casoId: caso.id, centavos: 500000n, nombreDonante: null, publicarNombre: false, comprobanteId: "doc-2" },
      ctx.repositorio
    );
    expect(intencion.id).toBeTruthy();
  });
});

describe("verificarTransferencia", () => {
  it("crea el asiento y recién ahí suma al total público", async () => {
    const { ctx, caso, intencion } = await casoConTransferencia();
    await verificarTransferencia(intencion.id, ctx);
    const actualizado = await ctx.repositorio.casoPorId(caso.id);
    expect(actualizado!.recibidoCentavos).toBe(1000000n);
    expect((await ctx.repositorio.intencionPorId(intencion.id))!.estado).toBe("APROBADA");
  });

  it("ya no queda pendiente", async () => {
    const { ctx, caso, intencion } = await casoConTransferencia();
    await verificarTransferencia(intencion.id, ctx);
    expect(await totalPendienteDeVerificar(caso.id, ctx.repositorio)).toBe(0n);
  });

  it("no se puede verificar dos veces", async () => {
    const { ctx, intencion } = await casoConTransferencia();
    await verificarTransferencia(intencion.id, ctx);
    await expect(verificarTransferencia(intencion.id, ctx)).rejects.toThrow(/ya .*verificada|no está pendiente/i);
  });

  it("el rol de redacción no puede verificar", async () => {
    const { ctx, intencion } = await casoConTransferencia();
    const ctxRedaccion = { ...ctx, rol: "REDACCION" as const };
    await expect(verificarTransferencia(intencion.id, ctxRedaccion)).rejects.toThrow(/permiso/i);
  });

  it("deja rastro de quién la verificó", async () => {
    const { ctx, intencion } = await casoConTransferencia();
    await verificarTransferencia(intencion.id, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas.some((e) => e.accion === "transferencia.verificar" && e.usuarioEmail === "carla@huellas.org.ar")).toBe(true);
  });
});

describe("rechazarTransferencia", () => {
  it("queda rechazada y nunca suma", async () => {
    const { ctx, caso, intencion } = await casoConTransferencia();
    await rechazarTransferencia(intencion.id, "No aparece en el extracto del Banco Nación", ctx);
    expect((await ctx.repositorio.intencionPorId(intencion.id))!.estado).toBe("RECHAZADA");
    expect((await ctx.repositorio.casoPorId(caso.id))!.recibidoCentavos).toBe(0n);
  });

  it("exige un motivo: el rechazo también se audita", async () => {
    const { ctx, intencion } = await casoConTransferencia();
    await expect(rechazarTransferencia(intencion.id, "", ctx)).rejects.toThrow(/motivo/i);
  });
});
