import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import type { EstadoDePago, PagoConsultado, ProveedorDePagos } from "@/domains/pagos/tipos";

/**
 * Solo "approved" cuenta. Cualquier estado que no conozcamos se trata como
 * pendiente: ante la duda, no se suma plata al total público.
 */
export function traducirEstado(estado: string): EstadoDePago {
  if (estado === "approved") return "aprobado";
  if (["rejected", "cancelled", "refunded", "charged_back"].includes(estado)) return "rechazado";
  return "pendiente";
}

/** Mercado Pago informa pesos con decimales; la base guarda centavos enteros. */
export function aCentavos(pesos: number): bigint {
  return BigInt(Math.round(pesos * 100));
}

function cliente(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN");
  return new MercadoPagoConfig({ accessToken });
}

export function mercadoPago(): ProveedorDePagos {
  return {
    nombre: "mercadopago",

    async crearPreferencia(datos) {
      const preferencia = await new Preference(cliente()).create({
        body: {
          items: [
            {
              id: datos.intencionId,
              title: datos.titulo,
              quantity: 1,
              unit_price: Number(datos.centavos) / 100,
              currency_id: datos.moneda,
            },
          ],
          // Así vuelve la intención en el aviso: es el hilo que une el pago
          // con el caso y con la preferencia de anonimato.
          external_reference: datos.intencionId,
          back_urls: { success: datos.urlRetorno, failure: datos.urlRetorno, pending: datos.urlRetorno },
          notification_url: datos.urlAviso,
        },
      });

      if (!preferencia.id || !preferencia.init_point) {
        throw new Error("Mercado Pago no devolvió la preferencia");
      }
      return { referenciaExterna: preferencia.id, urlDePago: preferencia.init_point };
    },

    async consultarPago(pagoExternoId): Promise<PagoConsultado> {
      try {
        const pago = await new Payment(cliente()).get({ id: pagoExternoId });
        return {
          estado: traducirEstado(pago.status ?? ""),
          centavos: aCentavos(pago.transaction_amount ?? 0),
          referenciaExterna: pago.external_reference ?? null,
        };
      } catch {
        // Puede ser una carrera con la propagación interna del proveedor:
        // quien llama decide si reintentar.
        return { estado: "inexistente", centavos: 0n, referenciaExterna: null };
      }
    },
  };
}
