import { describe, it, expect } from "vitest";
import { procesarAviso } from "@/domains/pagos/procesar-aviso";
import { crearCaso } from "@/domains/finanzas/casos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import { proveedorFalso } from "../dobles/proveedor-pagos-falso";

const base = {
  titulo: "Luna — cirugía",
  situacion: "La atropellaron en Provincias Unidas y necesita cirugía de cadera.",
  metaCentavos: 50000000n,
};

async function escenario(estadoDelPago: "aprobado" | "rechazado" | "pendiente" | "inexistente" = "aprobado") {
  const repositorio = repositorioFinanzasEnMemoria();
  const auditoria = auditoriaEnMemoria();
  const ctxAlta = { usuarioEmail: "carla@huellas.org.ar", rol: "FINANZAS" as const, repositorio, auditoria };
  const caso = await crearCaso(base, ctxAlta);

  const intencion = await repositorio.crearIntencion({
    casoId: caso.id,
    centavos: 2500000n,
    moneda: "ARS",
    nombreDonante: "Marina",
    publicarNombre: true,
    mensaje: null,
    proveedor: "mercadopago",
    estado: "INICIADA",
    referenciaExterna: "pref-1",
    pagoExternoId: null,
    comprobanteId: null,
  });

  const proveedor = proveedorFalso({
    "1327884391": { estado: estadoDelPago, centavos: 2500000n, referenciaExterna: intencion.id },
  });

  return { repositorio, auditoria, proveedor, caso, intencion };
}

function contextoAviso(e: Awaited<ReturnType<typeof escenario>>) {
  return { repositorio: e.repositorio, auditoria: e.auditoria, proveedor: e.proveedor };
}

describe("procesarAviso", () => {
  it("un pago aprobado crea el asiento y mueve el total", async () => {
    const e = await escenario("aprobado");
    const resultado = await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));

    expect(resultado.tipo).toBe("asentado");
    expect((await e.repositorio.casoPorId(e.caso.id))!.recibidoCentavos).toBe(2500000n);
    expect((await e.repositorio.intencionPorId(e.intencion.id))!.estado).toBe("APROBADA");
  });

  it("nunca se cree el aviso: consulta al proveedor antes de asentar", async () => {
    const e = await escenario("aprobado");
    await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));
    expect(e.proveedor.consultas).toContain("1327884391");
  });

  it("un pago rechazado no crea asiento", async () => {
    const e = await escenario("rechazado");
    const resultado = await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));

    expect(resultado.tipo).toBe("no-aprobado");
    expect((await e.repositorio.casoPorId(e.caso.id))!.recibidoCentavos).toBe(0n);
    expect((await e.repositorio.intencionPorId(e.intencion.id))!.estado).toBe("RECHAZADA");
  });

  it("un pago pendiente no crea asiento y deja la intención como estaba", async () => {
    const e = await escenario("pendiente");
    const resultado = await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));

    expect(resultado.tipo).toBe("no-aprobado");
    expect((await e.repositorio.intencionPorId(e.intencion.id))!.estado).toBe("INICIADA");
  });

  it("un pago que el proveedor no conoce se informa para reintentar", async () => {
    const e = await escenario("inexistente");
    const resultado = await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));
    expect(resultado.tipo).toBe("reintentar");
  });

  it("dos avisos sobre el mismo pago generan un solo asiento", async () => {
    const e = await escenario("aprobado");
    await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));
    const segundo = await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));

    expect(segundo.tipo).toBe("ya-procesado");
    expect((await e.repositorio.casoPorId(e.caso.id))!.recibidoCentavos).toBe(2500000n);
    expect(e.repositorio.asientos).toHaveLength(1);
  });

  it("el importe asentado es el que informa el proveedor, no el de la intención", async () => {
    const e = await escenario("aprobado");
    // Alguien manipuló la intención después de crearla; manda lo que se pagó.
    await e.repositorio.actualizarIntencion(e.intencion.id, { centavos: 99999999n });
    await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));
    expect((await e.repositorio.casoPorId(e.caso.id))!.recibidoCentavos).toBe(2500000n);
  });

  it("un pago sin intención conocida no inventa un caso", async () => {
    const e = await escenario("aprobado");
    const proveedor = proveedorFalso({
      "999": { estado: "aprobado", centavos: 100n, referenciaExterna: "intencion-que-no-existe" },
    });
    const resultado = await procesarAviso({ pagoExternoId: "999" }, { ...contextoAviso(e), proveedor });
    expect(resultado.tipo).toBe("sin-intencion");
    expect(e.repositorio.asientos).toHaveLength(0);
  });
});
