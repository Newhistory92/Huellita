import estilos from "./Boton.module.css";

type Variante = "donar" | "primario" | "fantasma";

export function Boton({
  variante = "primario",
  tamano,
  children,
  ...resto
}: {
  variante?: Variante;
  tamano?: "sm";
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const clases = [estilos.boton, estilos[variante], tamano === "sm" ? estilos.chico : ""].join(" ");
  return (
    <button className={clases} {...resto}>
      {children}
    </button>
  );
}
