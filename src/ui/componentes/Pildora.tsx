import estilos from "./Pildora.module.css";

type Tono = "ok" | "warn" | "bad" | "neutro" | "marca" | "adoptado";

export function Pildora({ tono = "neutro", children }: { tono?: Tono; children: React.ReactNode }) {
  const clases = [estilos.pildora, estilos[tono]].join(" ");
  return <span className={clases}>{children}</span>;
}
