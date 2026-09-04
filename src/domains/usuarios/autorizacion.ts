export type Rol = "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";

export type Accion =
  | "animales.leer" | "animales.escribir"
  | "postulaciones.leer" | "postulaciones.escribir"
  | "finanzas.leer" | "finanzas.escribir"
  | "novedades.escribir";

/** Tabla de la spec §7. El total que resulta del libro contable no tiene acción de escritura para ningún rol: es siempre un cálculo derivado. */
const PERMISOS: Record<Rol, Accion[]> = {
  ADMINISTRACION: [
    "animales.leer", "animales.escribir",
    "postulaciones.leer", "postulaciones.escribir",
    "finanzas.leer", "finanzas.escribir", "novedades.escribir",
  ],
  ANIMALES: [
    "animales.leer", "animales.escribir",
    "postulaciones.leer", "postulaciones.escribir",
    "finanzas.leer", "novedades.escribir",
  ],
  FINANZAS: ["animales.leer", "finanzas.leer", "finanzas.escribir"],
  REDACCION: ["animales.leer", "finanzas.leer", "novedades.escribir"],
};

export function puede(rol: Rol, accion: Accion): boolean {
  return PERMISOS[rol].includes(accion);
}
