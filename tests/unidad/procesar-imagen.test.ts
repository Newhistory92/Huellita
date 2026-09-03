import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { procesarImagen, MEDIDAS } from "@/infra/imagenes/procesar";

async function imagenDePrueba(ancho: number, alto: number): Promise<Buffer> {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: "#0E6B57" } })
    .jpeg()
    .toBuffer();
}

describe("procesarImagen", () => {
  it("genera todas las medidas menores o iguales al original", async () => {
    const resultado = await procesarImagen(await imagenDePrueba(2000, 1500));
    expect(resultado.medidas.map((m) => m.ancho)).toEqual(MEDIDAS);
  });

  it("no agranda una imagen chica", async () => {
    const resultado = await procesarImagen(await imagenDePrueba(400, 300));
    expect(resultado.medidas.every((m) => m.ancho <= 400)).toBe(true);
  });

  it("devuelve las dimensiones originales para reservar el espacio", async () => {
    const resultado = await procesarImagen(await imagenDePrueba(1200, 900));
    expect(resultado.ancho).toBe(1200);
    expect(resultado.alto).toBe(900);
  });

  it("produce una miniatura embebida chica", async () => {
    const resultado = await procesarImagen(await imagenDePrueba(1200, 900));
    expect(resultado.placeholder.startsWith("data:image/webp;base64,")).toBe(true);
    expect(resultado.placeholder.length).toBeLessThan(2000);
  });
});
