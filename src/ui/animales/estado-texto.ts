import type { Animal, EstadoAnimal } from "@/domains/animales/tipos";

type TonoPildora = "ok" | "warn" | "bad" | "neutro" | "marca" | "adoptado";

export const TONO_POR_ESTADO: Record<EstadoAnimal, TonoPildora> = {
  BORRADOR: "neutro",
  DISPONIBLE: "ok",
  EN_EVALUACION: "warn",
  RESERVADO: "warn",
  ADOPTADO: "adoptado",
  TRANSITO: "marca",
  TRATAMIENTO: "warn",
  NO_DISPONIBLE: "bad",
  FALLECIDO: "bad",
};

/** "Adoptado" concuerda en género con el animal; el resto de los estados no varía. */
export function etiquetaEstado(animal: Pick<Animal, "estado" | "sexo">): string {
  switch (animal.estado) {
    case "DISPONIBLE":
      return "Disponible";
    case "EN_EVALUACION":
      return "En evaluación";
    case "RESERVADO":
      return "Reservado";
    case "ADOPTADO":
      return animal.sexo === "HEMBRA" ? "Adoptada" : "Adoptado";
    case "TRANSITO":
      return "En tránsito";
    case "TRATAMIENTO":
      return "En tratamiento";
    case "NO_DISPONIBLE":
      return "No disponible";
    case "FALLECIDO":
      return "Falleció";
    default:
      return animal.estado;
  }
}

export const ESPECIE_EN_TEXTO: Record<Animal["especie"], string> = {
  PERRO: "Perro",
  GATO: "Gato",
  OTRO: "Animal",
};

export const TAMANO_EN_TEXTO: Record<Animal["tamano"], string> = {
  PEQUENO: "Pequeño",
  MEDIANO: "Mediano",
  GRANDE: "Grande",
};

export const SEXO_EN_TEXTO: Record<Animal["sexo"], string> = {
  MACHO: "Macho",
  HEMBRA: "Hembra",
};
