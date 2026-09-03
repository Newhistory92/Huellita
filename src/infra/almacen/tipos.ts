export interface AlmacenDeArchivos {
  guardar(clave: string, datos: Buffer, tipo: string): Promise<void>;
  url(clave: string): string;
  borrar(clave: string): Promise<void>;
}
