/**
 * Las cuatro variables que hacen falta para guardar las fotos en la nube.
 * Sin las cuatro, la aplicación usa el disco local.
 */
export const CLAVES_S3 = [
  "ALMACEN_S3_ENDPOINT",
  "ALMACEN_S3_BUCKET",
  "ALMACEN_S3_CLAVE",
  "ALMACEN_S3_SECRETO",
] as const;

function tieneValor(clave: string): boolean {
  return (process.env[clave] ?? "").trim().length > 0;
}

/** Cuáles de las cuatro faltan. Vacío significa que está todo. */
export function faltantesDeConfiguracion(): string[] {
  return CLAVES_S3.filter((clave) => !tieneValor(clave));
}

/**
 * Solo con las cuatro. Una configuración a medias no se toma por buena: la
 * aplicación arrancaría guardando en el disco de un servidor que se borra en
 * cada despliegue, y nadie se enteraría hasta que las fotos desaparezcan.
 */
export function hayAlmacenEnLaNubeConfigurado(): boolean {
  return faltantesDeConfiguracion().length === 0;
}

/**
 * Corta el paso si en producción no hay almacén persistente configurado.
 *
 * Sin esta guarda, subir una foto en producción parece funcionar: se guarda en
 * el disco del servidor, se ve en pantalla, y desaparece en el próximo
 * despliegue. La asociación cargaría animales durante semanas y perdería todas
 * las fotos sin un solo mensaje de error.
 */
export function exigirAlmacenPersistente(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (hayAlmacenEnLaNubeConfigurado()) return;

  throw new Error(
    "No hay almacenamiento de fotos configurado. En producción las fotos no pueden " +
      `guardarse en el disco del servidor: se borran en cada despliegue. Faltan estas ` +
      `variables de entorno: ${faltantesDeConfiguracion().join(", ")}.`
  );
}

/**
 * Dirección pública desde la que se sirven las fotos. Vacía en desarrollo: ahí
 * las sirve la propia aplicación desde el disco.
 *
 * Lleva el prefijo NEXT_PUBLIC porque la galería y el panel son componentes de
 * cliente y arman las direcciones en el navegador.
 */
export function urlPublicaDeArchivos(): string {
  return (process.env.NEXT_PUBLIC_ALMACEN_URL ?? "").trim();
}
