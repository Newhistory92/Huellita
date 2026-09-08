import type { PagoConsultado, ProveedorDePagos } from "@/domains/pagos/tipos";

export function proveedorFalso(pagos: Record<string, PagoConsultado> = {}) {
  const preferencias: string[] = [];
  const consultas: string[] = [];

  const proveedor: ProveedorDePagos = {
    nombre: "falso",
    async crearPreferencia(datos) {
      preferencias.push(datos.intencionId);
      return { referenciaExterna: `pref-${datos.intencionId}`, urlDePago: `https://pago.falso/${datos.intencionId}` };
    },
    async consultarPago(pagoExternoId) {
      consultas.push(pagoExternoId);
      return pagos[pagoExternoId] ?? { estado: "inexistente", centavos: 0n, referenciaExterna: null };
    },
  };

  return Object.assign(proveedor, { preferencias, consultas });
}
