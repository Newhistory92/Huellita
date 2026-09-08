export type EstadoDePago = "aprobado" | "pendiente" | "rechazado" | "inexistente";

export interface PagoConsultado {
  estado: EstadoDePago;
  centavos: bigint;
  /** El identificador de la intención que viajó como referencia externa. */
  referenciaExterna: string | null;
}

export interface DatosDePreferencia {
  intencionId: string;
  titulo: string;
  centavos: bigint;
  moneda: string;
  urlRetorno: string;
  urlAviso: string;
}

export interface PreferenciaCreada {
  referenciaExterna: string;
  urlDePago: string;
}

/**
 * El dominio habla con este puerto, nunca con Mercado Pago. Así las pruebas
 * corren sin red y agregar otro proveedor no toca ninguna regla de negocio.
 */
export interface ProveedorDePagos {
  readonly nombre: string;
  crearPreferencia(datos: DatosDePreferencia): Promise<PreferenciaCreada>;
  /** Se consulta contra la API del proveedor. Nunca se cree lo que dice el aviso. */
  consultarPago(pagoExternoId: string): Promise<PagoConsultado>;
}
