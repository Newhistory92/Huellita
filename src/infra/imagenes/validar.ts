export type TipoImagen = "image/jpeg" | "image/png" | "image/webp";

const FIRMAS: Array<{ tipo: TipoImagen; bytes: number[]; desde: number }> = [
  { tipo: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47], desde: 0 },
  { tipo: "image/jpeg", bytes: [0xff, 0xd8, 0xff], desde: 0 },
  { tipo: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], desde: 8 },
];

/**
 * El tipo se determina por el contenido real del archivo. Ni la extensión ni
 * el tipo que declara el navegador sirven: los controla quien sube el archivo.
 */
export async function validarImagen(datos: Buffer): Promise<TipoImagen> {
  for (const firma of FIRMAS) {
    const trozo = datos.subarray(firma.desde, firma.desde + firma.bytes.length);
    if (trozo.length === firma.bytes.length && firma.bytes.every((b, i) => trozo[i] === b)) {
      return firma.tipo;
    }
  }
  throw new Error("El archivo no es una imagen válida");
}

export const TAMANO_MAXIMO_BYTES = 12 * 1024 * 1024;
