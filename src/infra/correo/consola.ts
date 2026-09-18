import type { CorreoParaEnviar, ProveedorDeCorreo } from "@/domains/avisos/tipos";

/**
 * En desarrollo los correos se escriben en la consola. Permite trabajar el
 * flujo entero —anotar, agrupar, vaciar la cola— sin mandar un solo correo de
 * verdad ni necesitar una cuenta.
 */
export function correoConsola(): ProveedorDeCorreo {
  return {
    nombre: "consola",
    async enviar(correo: CorreoParaEnviar) {
      console.info(
        `\n--- CORREO (no se envió: proveedor de consola) ---\n` +
          `Para: ${correo.para.join(", ")}\n` +
          `Asunto: ${correo.asunto}\n\n${correo.cuerpo}\n--- fin ---\n`
      );
    },
  };
}
