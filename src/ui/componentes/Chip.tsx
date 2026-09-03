import estilos from "./Chip.module.css";

export function Chip({
  presionado,
  children,
  ...resto
}: {
  presionado?: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={estilos.chip} aria-pressed={presionado} {...resto}>
      {children}
    </button>
  );
}
