import { describe, it, expect } from "vitest";
import { formatearCentavos, esIngreso, sumarCentavos, separarPorSigno, referenciaDeAsiento } from "@/domains/finanzas/dinero";

describe("formatearCentavos", () => {
  it("usa el formato argentino, con punto de miles", () => {
    expect(formatearCentavos(32750000n)).toBe("$327.500");
  });

  it("muestra los centavos solo cuando los hay", () => {
    expect(formatearCentavos(150050n)).toBe("$1.500,50");
    expect(formatearCentavos(150000n)).toBe("$1.500");
  });

  it("un egreso se muestra en positivo: el signo lo pone la interfaz", () => {
    expect(formatearCentavos(-8000000n)).toBe("$80.000");
  });

  it("el cero es cero, no vacío", () => {
    expect(formatearCentavos(0n)).toBe("$0");
  });
});

describe("signo de los movimientos", () => {
  it("positivo entra, negativo sale", () => {
    expect(esIngreso(5000n)).toBe(true);
    expect(esIngreso(-5000n)).toBe(false);
  });

  it("suma sin perder precisión en montos grandes", () => {
    // Con decimales de punto flotante esta suma daría 8943199.999999999
    expect(sumarCentavos([894319900n, 100n])).toBe(894320000n);
  });

  it("separa entradas de salidas y devuelve las salidas en positivo", () => {
    expect(separarPorSigno([10000n, -3000n, 5000n, -2000n])).toEqual({ entradas: 15000n, salidas: 5000n });
  });
});

describe("referenciaDeAsiento", () => {
  it("acorta el identificador a algo que una persona pueda dictar por teléfono", () => {
    expect(referenciaDeAsiento("cmtrybavq0002t9fgfcbk7ms5")).toBe("MOV-K7MS5");
  });

  it("dos asientos distintos dan referencias distintas", () => {
    const a = referenciaDeAsiento("cmtrybavq0002t9fgfcbk7ms5");
    const b = referenciaDeAsiento("cmtrybazu0004t9fgq6s534iu");
    expect(a).not.toBe(b);
  });

  it("tolera un identificador más corto que el recorte", () => {
    expect(referenciaDeAsiento("abc")).toBe("MOV-ABC");
  });

  it("nunca devuelve solo el prefijo", () => {
    expect(referenciaDeAsiento("")).toBe("MOV-?");
  });
});
