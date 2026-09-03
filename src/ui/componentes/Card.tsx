import estilos from "./Card.module.css";

export function Card({
  elevacion = false,
  className,
  children,
}: {
  elevacion?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const clases = [estilos.card, elevacion ? estilos.conElevacion : "", className ?? ""].join(" ").trim();
  return <div className={clases}>{children}</div>;
}

export function CardCuerpo({ children }: { children: React.ReactNode }) {
  return <div className={estilos.cuerpo}>{children}</div>;
}
