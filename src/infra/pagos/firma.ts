import { createHmac, timingSafeEqual } from "node:crypto";

export interface DatosDeFirma {
  cabeceraFirma: string | null;
  cabeceraPedido: string | null;
  idDelRecurso: string;
  secreto: string;
}

/**
 * Mercado Pago firma cada aviso con un secreto que solo conocen ellos y
 * nosotros. Sin esta validación, cualquiera que descubra la dirección del
 * webhook podría inventar donaciones.
 *
 * La cabecera llega como "ts=<marca>,v1=<firma>", y el manifiesto que se firma
 * es "id:<recurso>;request-id:<pedido>;ts:<marca>;".
 */
export function firmaValida({ cabeceraFirma, cabeceraPedido, idDelRecurso, secreto }: DatosDeFirma): boolean {
  if (!secreto || !cabeceraFirma) return false;

  const partes = Object.fromEntries(
    cabeceraFirma.split(",").map((trozo) => {
      const [clave, valor] = trozo.split("=");
      return [clave?.trim(), valor?.trim()];
    })
  );

  const marca = partes.ts;
  const recibida = partes.v1;
  if (!marca || !recibida) return false;

  const manifiesto = `id:${idDelRecurso};request-id:${cabeceraPedido ?? ""};ts:${marca};`;
  const esperada = createHmac("sha256", secreto).update(manifiesto).digest("hex");

  const a = Buffer.from(esperada, "utf8");
  const b = Buffer.from(recibida, "utf8");
  if (a.length !== b.length) return false;
  // Comparación de tiempo constante: una comparación normal filtra por
  // cuánto tarda en fallar y permite adivinar la firma carácter por carácter.
  return timingSafeEqual(a, b);
}
