import { describe, it, expect } from "vitest";
import { puede } from "@/domains/usuarios/autorizacion";

describe("permisos por rol", () => {
  it("administración puede todo", () => {
    expect(puede("ADMINISTRACION", "animales.escribir")).toBe(true);
    expect(puede("ADMINISTRACION", "finanzas.escribir")).toBe(true);
  });

  it("animales gestiona animales pero solo lee finanzas", () => {
    expect(puede("ANIMALES", "animales.escribir")).toBe(true);
    expect(puede("ANIMALES", "finanzas.escribir")).toBe(false);
    expect(puede("ANIMALES", "finanzas.leer")).toBe(true);
  });

  it("finanzas no accede a postulaciones", () => {
    expect(puede("FINANZAS", "postulaciones.leer")).toBe(false);
    expect(puede("FINANZAS", "finanzas.escribir")).toBe(true);
  });

  it("redacción solo escribe novedades", () => {
    expect(puede("REDACCION", "novedades.escribir")).toBe(true);
    expect(puede("REDACCION", "animales.escribir")).toBe(false);
  });
});
