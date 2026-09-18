import type { PuertoAuditoria } from "@/domains/animales/tipos";

export type TipoAviso = "POSTULACION_NUEVA" | "TRANSFERENCIA_PENDIENTE" | "DONACION_VERIFICADA" | "META_ALCANZADA";

export type Rol = "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";

export interface AvisoPendiente {
  id: string;
  tipo: TipoAviso;
  /** El hecho, no el correo redactado. Ver §4.2 de la especificación. */
  datos: Record<string, unknown>;
  originadoPorEmail: string | null;
  creadoEn: Date;
  enviadoEn: Date | null;
  intentos: number;
  ultimoError: string | null;
}

export interface CorreoParaEnviar {
  para: string[];
  asunto: string;
  cuerpo: string;
}

/** El dominio habla con este puerto. Nunca con Resend. */
export interface ProveedorDeCorreo {
  readonly nombre: string;
  enviar(correo: CorreoParaEnviar): Promise<void>;
}

export interface NuevoAviso {
  tipo: TipoAviso;
  datos: Record<string, unknown>;
  originadoPorEmail?: string | null;
}

/**
 * Lo que el dominio usa para anotar un aviso. Es solo una escritura en la
 * base, igual que la auditoría, así que va dentro de la transacción sin
 * problema: lo que nunca va adentro es el envío del correo.
 */
export interface PuertoAvisos {
  anotar(aviso: NuevoAviso): Promise<void>;
}

export interface RepositorioAvisos {
  anotar(aviso: NuevoAviso): Promise<void>;
  /** Los que faltan enviar y todavía no agotaron los intentos. */
  pendientes(limite: number, maxIntentos: number): Promise<AvisoPendiente[]>;
  marcarEnviados(ids: string[], cuando: Date): Promise<void>;
  registrarFallo(ids: string[], error: string): Promise<void>;
  /** Correos de los usuarios activos con alguno de esos roles. */
  correosDeRoles(roles: Rol[]): Promise<string[]>;
}

export interface ContextoAvisos {
  repositorio: RepositorioAvisos;
  correo: ProveedorDeCorreo;
  auditoria: PuertoAuditoria;
}
