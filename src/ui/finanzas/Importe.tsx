import { formatearCentavos } from "@/domains/finanzas/dinero";
import estilos from "./Importe.module.css";

/**
 * El signo y el color los pone acá, no el formateador: el mismo importe se
 * muestra sin signo en un total y con signo en el libro.
 */
export function Importe({
  centavos,
  conSigno = false,
  tamano = "normal",
}: {
  centavos: bigint;
  conSigno?: boolean;
  tamano?: "normal" | "grande";
}) {
  const entra = centavos > 0n;
  const clases = [estilos.importe, tamano === "grande" ? estilos.grande : "", conSigno ? (entra ? estilos.entra : estilos.sale) : ""]
    .join(" ")
    .trim();

  return (
    <span className={clases}>
      {conSigno ? (entra ? "+" : "−") : ""}
      {formatearCentavos(centavos)}
    </span>
  );
}
