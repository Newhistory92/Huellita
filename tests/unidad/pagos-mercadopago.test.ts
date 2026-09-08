import { describe, it, expect } from "vitest";
import { traducirEstado, aCentavos } from "@/infra/pagos/mercadopago";

describe("traducirEstado", () => {
  it("solo 'approved' cuenta como aprobado", () => {
    expect(traducirEstado("approved")).toBe("aprobado");
  });

  it("los estados intermedios son pendientes, no aprobados", () => {
    expect(traducirEstado("in_process")).toBe("pendiente");
    expect(traducirEstado("pending")).toBe("pendiente");
    expect(traducirEstado("authorized")).toBe("pendiente");
  });

  it("los estados terminales negativos son rechazados", () => {
    expect(traducirEstado("rejected")).toBe("rechazado");
    expect(traducirEstado("cancelled")).toBe("rechazado");
    expect(traducirEstado("refunded")).toBe("rechazado");
    expect(traducirEstado("charged_back")).toBe("rechazado");
  });

  it("un estado que no conocemos nunca se toma por aprobado", () => {
    expect(traducirEstado("estado_futuro_de_mercadopago")).toBe("pendiente");
  });
});

describe("aCentavos", () => {
  it("convierte pesos con decimales a centavos enteros", () => {
    expect(aCentavos(25000)).toBe(2500000n);
    expect(aCentavos(1500.5)).toBe(150050n);
  });

  it("redondea al centavo: no arrastra el error del punto flotante", () => {
    expect(aCentavos(0.1 + 0.2)).toBe(30n);
  });
});
