export type EstadoAnimal =
  | "BORRADOR" | "DISPONIBLE" | "EN_EVALUACION" | "RESERVADO"
  | "ADOPTADO" | "TRANSITO" | "TRATAMIENTO" | "NO_DISPONIBLE" | "FALLECIDO";

export type Especie = "PERRO" | "GATO" | "OTRO";
export type Sexo = "MACHO" | "HEMBRA";
export type Tamano = "PEQUENO" | "MEDIANO" | "GRANDE";

export interface Animal {
  id: string;
  slug: string;
  nombre: string;
  especie: Especie;
  sexo: Sexo;
  tamano: Tamano;
  descripcion: string;
  estado: EstadoAnimal;
  archivado: boolean;
  publicadoEn: Date | null;
  atributos: Record<string, unknown>;
}

export interface FiltroAnimales {
  especie?: Especie;
  tamano?: Tamano;
  estado?: EstadoAnimal;
  soloPublicados?: boolean;
}

export interface RepositorioAnimales {
  crear(datos: Omit<Animal, "id">): Promise<Animal>;
  actualizar(id: string, cambios: Partial<Animal>): Promise<Animal>;
  porId(id: string): Promise<Animal | null>;
  porSlug(slug: string): Promise<Animal | null>;
  slugsExistentes(): Promise<string[]>;
  listar(filtro: FiltroAnimales): Promise<Animal[]>;
}

export interface EntradaAuditoria {
  usuarioEmail: string;
  accion: string;
  entidad: string;
  entidadId: string;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
}

export interface PuertoAuditoria {
  registrar(entrada: EntradaAuditoria): Promise<void>;
}

export interface Contexto {
  usuarioEmail: string;
  rol: "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";
  repositorio: RepositorioAnimales;
  auditoria: PuertoAuditoria;
}
