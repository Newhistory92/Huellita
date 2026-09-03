import sharp from "sharp";

export const MEDIDAS = [320, 640, 1024, 1600] as const;

export interface ImagenProcesada {
  medidas: Array<{ ancho: number; datos: Buffer }>;
  placeholder: string;
  ancho: number;
  alto: number;
}

/**
 * El original nunca se sirve. Se generan varias medidas en WebP más una
 * miniatura embebida que reserva el espacio mientras carga, para que la
 * página no salte.
 */
export async function procesarImagen(datos: Buffer): Promise<ImagenProcesada> {
  const original = sharp(datos).rotate(); // respeta la orientación EXIF
  const meta = await original.metadata();
  const ancho = meta.width ?? 0;
  const alto = meta.height ?? 0;

  const medidas = await Promise.all(
    MEDIDAS.map(async (medida) => ({
      ancho: Math.min(medida, ancho),
      datos: await sharp(datos)
        .rotate()
        .resize({ width: medida, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer(),
    }))
  );

  const miniatura = await sharp(datos).rotate().resize({ width: 16 }).webp({ quality: 30 }).toBuffer();

  return {
    medidas,
    placeholder: `data:image/webp;base64,${miniatura.toString("base64")}`,
    ancho,
    alto,
  };
}
