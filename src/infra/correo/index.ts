import type { ProveedorDeCorreo } from "@/domains/avisos/tipos";
import { correoConsola } from "./consola";
import { correoResend } from "./resend";

export function hayCorreoConfigurado(): boolean {
  return (process.env.RESEND_API_KEY ?? "").trim().length > 0 && (process.env.CORREO_REMITENTE ?? "").trim().length > 0;
}

/**
 * Único punto donde se elige el proveedor. Sin configuración usa la consola,
 * que es lo correcto en desarrollo: el flujo se prueba entero sin mandar nada.
 */
export function correo(): ProveedorDeCorreo {
  return hayCorreoConfigurado() ? correoResend() : correoConsola();
}
