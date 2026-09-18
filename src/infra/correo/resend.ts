import { Resend } from "resend";
import type { CorreoParaEnviar, ProveedorDeCorreo } from "@/domains/avisos/tipos";

export function correoResend(): ProveedorDeCorreo {
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;
  if (!clave || !remitente) throw new Error("Faltan RESEND_API_KEY o CORREO_REMITENTE");

  const cliente = new Resend(clave);

  return {
    nombre: "resend",
    async enviar(correo: CorreoParaEnviar) {
      const { error } = await cliente.emails.send({
        from: remitente,
        to: correo.para,
        subject: correo.asunto,
        text: correo.cuerpo,
      });

      // Resend devuelve el error en la respuesta en vez de lanzarlo. Si no se
      // revisa, un envío fallido pasa por exitoso y el aviso se marca enviado.
      if (error) throw new Error(`Resend rechazó el envío: ${error.message}`);
    },
  };
}
