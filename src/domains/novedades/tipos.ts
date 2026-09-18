import type { PuertoAuditoria } from "@/domains/animales/tipos";

export type Rol = "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";

export interface Foto {
  clave: string;
  alt: string;
  ancho: number;
  alto: number;
  placeholder: string;
}

export interface Novedad {
  id: string;
  /** Exactamente uno de los dos tiene valor. Ver §3.2 de la especificación. */
  casoId: string | null;
  animalId: string | null;
  titulo: string;
  cuerpo: string;
  foto: Foto | null;
  documentoId: string | null;
  autorEmail: string;
  archivada: boolean;
  creadoEn: Date;
}

export interface RepositorioNovedades {
  crear(datos: Omit<Novedad, "id" | "creadoEn">): Promise<Novedad>;
  actualizar(id: string, cambios: Partial<Novedad>): Promise<Novedad>;
  porId(id: string): Promise<Novedad | null>;
  /** Solo las activas, de la más nueva a la más vieja. */
  delCaso(casoId: string): Promise<Novedad[]>;
  delAnimal(animalId: string): Promise<Novedad[]>;
  /** Incluye archivadas: lo usa el panel. */
  todasDelCaso(casoId: string): Promise<Novedad[]>;
  todasDelAnimal(animalId: string): Promise<Novedad[]>;
}

export interface ContextoNovedades {
  usuarioEmail: string;
  rol: Rol;
  repositorio: RepositorioNovedades;
  auditoria: PuertoAuditoria;
}
