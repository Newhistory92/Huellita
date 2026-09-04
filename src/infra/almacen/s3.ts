import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { AlmacenDeArchivos } from "./tipos";
import { urlPublicaDeArchivos } from "./configuracion";

let cliente: S3Client | null = null;

/**
 * Un solo cliente para todo el proceso. Crear uno por pedido abre conexiones
 * nuevas cada vez y en una función sin servidor eso se paga en latencia.
 */
function clienteS3(): S3Client {
  if (cliente) return cliente;
  cliente = new S3Client({
    // Cloudflare R2 y la mayoría de los compatibles ignoran la región, pero el
    // cliente exige uno: "auto" es el valor que documenta R2.
    region: process.env.ALMACEN_S3_REGION ?? "auto",
    endpoint: process.env.ALMACEN_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.ALMACEN_S3_CLAVE!,
      secretAccessKey: process.env.ALMACEN_S3_SECRETO!,
    },
  });
  return cliente;
}

async function aBuffer(cuerpo: unknown): Promise<Buffer> {
  const trozos: Uint8Array[] = [];
  for await (const trozo of cuerpo as AsyncIterable<Uint8Array>) trozos.push(trozo);
  return Buffer.concat(trozos);
}

/**
 * Guarda las fotos en un depósito S3-compatible: Cloudflare R2, Supabase,
 * MinIO o el propio S3. La aplicación no sabe cuál es, solo habla el protocolo.
 */
export function almacenS3(): AlmacenDeArchivos {
  const bucket = process.env.ALMACEN_S3_BUCKET!;

  return {
    async guardar(clave, datos, tipo) {
      await clienteS3().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: clave,
          Body: datos,
          ContentType: tipo,
          // Las medidas se generan una vez y no cambian nunca: el nombre del
          // archivo lleva un identificador único. Se pueden cachear para
          // siempre, que es lo que evita pagar tráfico en cada visita.
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
    },

    url(clave) {
      const base = urlPublicaDeArchivos();
      return base ? `${base.replace(/\/+$/, "")}/${clave}` : `/archivos/${clave}`;
    },

    async borrar(clave) {
      await clienteS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: clave }));
    },

    async leer(clave) {
      try {
        const respuesta = await clienteS3().send(new GetObjectCommand({ Bucket: bucket, Key: clave }));
        return respuesta.Body ? await aBuffer(respuesta.Body) : null;
      } catch {
        // Un archivo que no está no es un error: la vista previa social se
        // arma igual, sin foto.
        return null;
      }
    },
  };
}
