import type { AlmacenDeArchivos } from "./tipos";
import { almacenLocal } from "./local";
import { almacenS3 } from "./s3";
import { hayAlmacenEnLaNubeConfigurado } from "./configuracion";

export type { AlmacenDeArchivos } from "./tipos";

/**
 * El único punto por el que la aplicación pide el almacén. Nadie más elige:
 * así, cambiar de proveedor no obliga a tocar ninguna pantalla.
 *
 * Con las cuatro variables configuradas, va a la nube. Sin ellas, al disco
 * local, que es lo correcto en desarrollo y una trampa en producción: en un
 * servidor sin estado, cada despliegue borra las fotos. Por eso conviene
 * llamar a `exigirAlmacenPersistente()` al desplegar.
 */
export function almacen(): AlmacenDeArchivos {
  return hayAlmacenEnLaNubeConfigurado() ? almacenS3() : almacenLocal();
}
