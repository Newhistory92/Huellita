import { describe, it, expect } from "vitest";
import { subirDocumento, obtenerDocumento } from "@/domains/finanzas/documentos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

function contexto(rol: "ADMINISTRACION" | "FINANZAS" | "REDACCION" = "FINANZAS") {
  return { usuarioEmail: "carla@huellas.org.ar", rol, repositorio: repositorioFinanzasEnMemoria(), auditoria: auditoriaEnMemoria() };
}

describe("subirDocumento", () => {
  it("sin confirmar el tachado de datos personales, el documento queda privado", async () => {
    const documento = await subirDocumento(
      { claveArchivo: "documentos/factura.pdf", nombre: "factura.pdf", tipo: "factura", datosPersonalesTachados: false },
      contexto()
    );
    expect(documento.publico).toBe(false);
    expect(documento.datosPersonalesTachados).toBe(false);
  });

  it("confirmando el tachado, el documento queda público", async () => {
    const documento = await subirDocumento(
      { claveArchivo: "documentos/recibo.pdf", nombre: "recibo.pdf", tipo: "recibo", datosPersonalesTachados: true },
      contexto()
    );
    expect(documento.publico).toBe(true);
  });

  it("registra quién lo subió", async () => {
    const documento = await subirDocumento(
      { claveArchivo: "documentos/acta.pdf", nombre: "acta.pdf", tipo: "acta", datosPersonalesTachados: true },
      contexto()
    );
    expect(documento.subidoPorEmail).toBe("carla@huellas.org.ar");
  });

  it("queda auditado", async () => {
    const ctx = contexto();
    await subirDocumento(
      { claveArchivo: "documentos/factura.pdf", nombre: "factura.pdf", tipo: "factura", datosPersonalesTachados: true },
      ctx
    );
    expect(ctx.auditoria.entradas).toHaveLength(1);
    expect(ctx.auditoria.entradas[0].accion).toBe("documento.subir");
  });

  it("Redacción no tiene permiso para subir documentos financieros", async () => {
    await expect(
      subirDocumento(
        { claveArchivo: "documentos/factura.pdf", nombre: "factura.pdf", tipo: "factura", datosPersonalesTachados: true },
        contexto("REDACCION")
      )
    ).rejects.toThrow();
  });
});

describe("obtenerDocumento", () => {
  it("lo devuelve aunque todavía sea privado: para que el panel verifique el comprobante", async () => {
    const ctx = contexto();
    const documento = await subirDocumento(
      { claveArchivo: "documentos/factura.pdf", nombre: "factura.pdf", tipo: "factura", datosPersonalesTachados: false },
      ctx
    );
    expect((await obtenerDocumento(documento.id, ctx))?.id).toBe(documento.id);
  });

  it("devuelve null si no existe", async () => {
    expect(await obtenerDocumento("no-existe", contexto())).toBeNull();
  });
});
