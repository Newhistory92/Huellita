import type { PuertoAuditoria } from "@/domains/animales/tipos";

export type TipoAsiento = "DONACION" | "GASTO" | "REEMBOLSO" | "TRANSFERENCIA" | "AJUSTE";
export type EstadoCaso = "ABIERTO" | "META_ALCANZADA" | "CERRADO";
export type EstadoIntencion = "INICIADA" | "PENDIENTE_VERIFICACION" | "APROBADA" | "RECHAZADA" | "ABANDONADA";
export type Rol = "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";

export interface Caso {
  id: string;
  slug: string;
  animalId: string | null;
  titulo: string;
  situacion: string;
  metaCentavos: bigint;
  moneda: string;
  estado: EstadoCaso;
  recibidoCentavos: bigint;
  gastadoCentavos: bigint;
  cantidadDonantes: number;
  creadoEn: Date;
}

export interface Asiento {
  id: string;
  casoId: string;
  tipo: TipoAsiento;
  centavos: bigint;
  moneda: string;
  descripcion: string;
  proveedor: string | null;
  pagoExternoId: string | null;
  ajustaAId: string | null;
  contraparteId: string | null;
  documentoId: string | null;
  intencionId: string | null;
  creadoPorId: string | null;
  creadoPorSistema: boolean;
  fechaEfectiva: Date;
  creadoEn: Date;
}

export interface Intencion {
  id: string;
  casoId: string;
  centavos: bigint;
  moneda: string;
  nombreDonante: string | null;
  publicarNombre: boolean;
  mensaje: string | null;
  proveedor: string;
  estado: EstadoIntencion;
  referenciaExterna: string | null;
  pagoExternoId: string | null;
  comprobanteId: string | null;
  creadoEn: Date;
  resueltoEn: Date | null;
}

/** Lo que la suma de asientos dice sobre un caso. */
export interface SaldoDelCaso {
  recibidoCentavos: bigint;
  gastadoCentavos: bigint;
  cantidadDonaciones: number;
}

export interface Documento {
  id: string;
  claveArchivo: string;
  nombre: string;
  tipo: string;
  publico: boolean;
  /** La §11 del sistema de diseño: sin esta confirmación, el documento no puede ser público. */
  datosPersonalesTachados: boolean;
  subidoPorEmail: string;
  creadoEn: Date;
}

export interface FiltroCasos {
  estado?: EstadoCaso;
  soloAbiertos?: boolean;
}

export interface RepositorioFinanzas {
  crearCaso(datos: Omit<Caso, "id" | "creadoEn">): Promise<Caso>;
  actualizarCaso(id: string, cambios: Partial<Caso>): Promise<Caso>;
  casoPorId(id: string): Promise<Caso | null>;
  casoPorSlug(slug: string): Promise<Caso | null>;
  slugsDeCasos(): Promise<string[]>;
  listarCasos(filtro: FiltroCasos): Promise<Caso[]>;

  crearAsiento(datos: Omit<Asiento, "id" | "creadoEn">): Promise<Asiento>;
  asientosDeCaso(casoId: string): Promise<Asiento[]>;
  /** Recalcula desde los asientos. No lee los campos derivados del caso. */
  saldoDeCaso(casoId: string): Promise<SaldoDelCaso>;
  asientoPorPagoExterno(proveedor: string, pagoExternoId: string): Promise<Asiento | null>;

  crearIntencion(datos: Omit<Intencion, "id" | "creadoEn" | "resueltoEn">): Promise<Intencion>;
  intencionPorId(id: string): Promise<Intencion | null>;
  actualizarIntencion(id: string, cambios: Partial<Intencion>): Promise<Intencion>;
  intencionesPendientes(): Promise<Intencion[]>;

  crearDocumento(datos: Omit<Documento, "id" | "creadoEn">): Promise<Documento>;
  documentoPorId(id: string): Promise<Documento | null>;
}

export interface ContextoFinanzas {
  usuarioEmail: string;
  rol: Rol;
  repositorio: RepositorioFinanzas;
  auditoria: PuertoAuditoria;
}
