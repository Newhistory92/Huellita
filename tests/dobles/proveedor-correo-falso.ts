import type { CorreoParaEnviar, ProveedorDeCorreo } from "@/domains/avisos/tipos";

export function proveedorCorreoFalso({ falla = false }: { falla?: boolean } = {}) {
  const enviados: CorreoParaEnviar[] = [];

  const proveedor: ProveedorDeCorreo = {
    nombre: "falso",
    async enviar(correo) {
      if (falla) throw new Error("el proveedor de correo no responde");
      enviados.push(correo);
    },
  };

  return Object.assign(proveedor, { enviados });
}
