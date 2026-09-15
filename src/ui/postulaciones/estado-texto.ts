import type { EstadoPostulacion } from "@/domains/postulaciones/tipos";

type TonoPildora = "ok" | "warn" | "bad" | "neutro" | "marca" | "adoptado";

export const TONO_POR_ESTADO: Record<EstadoPostulacion, TonoPildora> = {
  NUEVA: "warn",
  EN_REVISION: "neutro",
  CONTACTADA: "neutro",
  ENTREVISTA: "marca",
  APROBADA: "ok",
  RECHAZADA: "bad",
  ADOPCION_CONCRETADA: "adoptado",
};

export function etiquetaEstado(estado: EstadoPostulacion): string {
  switch (estado) {
    case "NUEVA":
      return "Nueva";
    case "EN_REVISION":
      return "En revisión";
    case "CONTACTADA":
      return "Contactada";
    case "ENTREVISTA":
      return "Entrevista";
    case "APROBADA":
      return "Aprobada";
    case "RECHAZADA":
      return "Rechazada";
    case "ADOPCION_CONCRETADA":
      return "Adopción concretada";
    default:
      return estado;
  }
}
