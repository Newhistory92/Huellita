import { describe, it, expect } from "vitest";
import { validarImagen } from "@/infra/imagenes/validar";

// Firmas reales de archivo. La extensión y el tipo declarado por el navegador
// se ignoran: los pone quien sube el archivo.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const EJECUTABLE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0]);

describe("validarImagen", () => {
  it("acepta PNG por su firma", async () => {
    await expect(validarImagen(PNG)).resolves.toBe("image/png");
  });

  it("acepta JPEG por su firma", async () => {
    await expect(validarImagen(JPEG)).resolves.toBe("image/jpeg");
  });

  it("rechaza un ejecutable aunque se llame foto.jpg", async () => {
    await expect(validarImagen(EJECUTABLE)).rejects.toThrow(/no es una imagen/i);
  });

  it("rechaza un archivo vacío", async () => {
    await expect(validarImagen(Buffer.alloc(0))).rejects.toThrow(/no es una imagen/i);
  });
});
