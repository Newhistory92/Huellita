import { describe, it, expect, vi, afterEach } from "vitest";
import { correoConsola } from "@/infra/correo/consola";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("proveedor de consola", () => {
  it("escribe el correo en la salida estándar en vez de mandarlo", async () => {
    const registro = vi.spyOn(console, "info").mockImplementation(() => {});
    await correoConsola().enviar({ para: ["marina@huellas.org.ar"], asunto: "Llegó una postulación", cuerpo: "Juanito" });

    const escrito = registro.mock.calls.flat().join(" ");
    expect(escrito).toContain("marina@huellas.org.ar");
    expect(escrito).toContain("Llegó una postulación");
  });

  it("se identifica por su nombre, para que el panel pueda decir cuál está activo", () => {
    expect(correoConsola().nombre).toBe("consola");
  });
});
