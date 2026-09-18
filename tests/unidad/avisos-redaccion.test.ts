import { describe, it, expect } from "vitest";
import { rolesQueReciben, redactar } from "@/domains/avisos/redaccion";
import type { AvisoPendiente } from "@/domains/avisos/tipos";

const aviso = (id: string, tipo: AvisoPendiente["tipo"], datos: Record<string, unknown>): AvisoPendiente => ({
  id,
  tipo,
  datos,
  originadoPorEmail: null,
  creadoEn: new Date("2026-09-15T10:00:00Z"),
  enviadoEn: null,
  intentos: 0,
  ultimoError: null,
});

describe("rolesQueReciben", () => {
  it("una postulación va a quien gestiona animales", () => {
    expect(rolesQueReciben("POSTULACION_NUEVA").sort()).toEqual(["ADMINISTRACION", "ANIMALES"]);
  });

  it("lo del dinero va a finanzas", () => {
    expect(rolesQueReciben("TRANSFERENCIA_PENDIENTE").sort()).toEqual(["ADMINISTRACION", "FINANZAS"]);
    expect(rolesQueReciben("DONACION_VERIFICADA").sort()).toEqual(["ADMINISTRACION", "FINANZAS"]);
    expect(rolesQueReciben("META_ALCANZADA").sort()).toEqual(["ADMINISTRACION", "FINANZAS"]);
  });

  it("redacción no recibe avisos: no gestiona ni animales ni plata", () => {
    for (const tipo of ["POSTULACION_NUEVA", "TRANSFERENCIA_PENDIENTE", "DONACION_VERIFICADA", "META_ALCANZADA"] as const) {
      expect(rolesQueReciben(tipo)).not.toContain("REDACCION");
    }
  });
});

describe("redactar", () => {
  const urlBase = "https://refugiohuellas.org.ar";

  it("un solo aviso: el asunto dice qué pasó", () => {
    const { asunto } = redactar([aviso("a", "POSTULACION_NUEVA", { nombreAnimal: "Juanito" })], urlBase);
    expect(asunto).toContain("Juanito");
    expect(asunto.toLowerCase()).toContain("postulación");
  });

  it("varios avisos: el asunto dice cuántos hay", () => {
    const { asunto } = redactar(
      [
        aviso("a", "POSTULACION_NUEVA", { nombreAnimal: "Juanito" }),
        aviso("b", "POSTULACION_NUEVA", { nombreAnimal: "Luna" }),
        aviso("c", "META_ALCANZADA", { tituloCaso: "Luna — cirugía" }),
      ],
      urlBase
    );
    expect(asunto).toContain("3");
  });

  it("el cuerpo lleva un enlace al panel por cada cosa que pasó", () => {
    const { cuerpo } = redactar(
      [
        aviso("a", "POSTULACION_NUEVA", { nombreAnimal: "Juanito", postulacionId: "post-1" }),
        aviso("b", "TRANSFERENCIA_PENDIENTE", { tituloCaso: "Luna — cirugía", montoTexto: "$10.000" }),
      ],
      urlBase
    );
    expect(cuerpo).toContain(`${urlBase}/panel/postulaciones/post-1`);
    expect(cuerpo).toContain(`${urlBase}/panel/finanzas/transferencias`);
  });

  it("una donación verificada dice el monto y el caso", () => {
    const { cuerpo } = redactar(
      [aviso("a", "DONACION_VERIFICADA", { tituloCaso: "Luna — cirugía", montoTexto: "$25.000" })],
      urlBase
    );
    expect(cuerpo).toContain("$25.000");
    expect(cuerpo).toContain("Luna — cirugía");
  });

  it("es texto plano, sin etiquetas HTML", () => {
    const { cuerpo } = redactar([aviso("a", "META_ALCANZADA", { tituloCaso: "Luna — cirugía" })], urlBase);
    expect(cuerpo).not.toMatch(/<[a-z]/i);
  });

  it("un tipo con datos incompletos no rompe el correo entero", () => {
    // Si un aviso viejo quedó sin un dato, el resto tiene que salir igual.
    const { cuerpo } = redactar(
      [aviso("a", "POSTULACION_NUEVA", {}), aviso("b", "META_ALCANZADA", { tituloCaso: "Luna — cirugía" })],
      urlBase
    );
    expect(cuerpo).toContain("Luna — cirugía");
  });
});
