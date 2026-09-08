import { describe, it, expect } from "vitest";
import { porcentajeDeAvance, faltaParaLaMeta, excedente } from "@/domains/finanzas/consultas";

const caso = (recibido: bigint, meta: bigint) => ({ recibidoCentavos: recibido, metaCentavos: meta });

describe("porcentajeDeAvance", () => {
  it("calcula el avance con un decimal", () => {
    expect(porcentajeDeAvance(caso(32750000n, 50000000n))).toBe(65.5);
  });

  it("no pasa de 100 aunque haya excedente: la barra no se desborda", () => {
    expect(porcentajeDeAvance(caso(62000000n, 50000000n))).toBe(100);
  });

  it("una meta de cero no rompe la división", () => {
    expect(porcentajeDeAvance(caso(1000n, 0n))).toBe(100);
  });
});

describe("faltaParaLaMeta", () => {
  it("dice cuánto falta", () => {
    expect(faltaParaLaMeta(caso(32750000n, 50000000n))).toBe(17250000n);
  });

  it("cuando ya se alcanzó, no falta nada: nunca un número negativo", () => {
    expect(faltaParaLaMeta(caso(62000000n, 50000000n))).toBe(0n);
  });
});

describe("excedente", () => {
  it("es cero mientras no se alcanzó la meta", () => {
    expect(excedente(caso(32750000n, 50000000n))).toBe(0n);
  });

  it("es lo que pasó de la meta", () => {
    expect(excedente(caso(62000000n, 50000000n))).toBe(12000000n);
  });
});
