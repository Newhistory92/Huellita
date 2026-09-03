import estilos from "./Campo.module.css";

/** Implementa el §5.14: etiqueta siempre visible, ayuda debajo, error junto al campo. */
export function Campo({
  etiqueta,
  nombre,
  ayuda,
  error,
  children,
}: {
  etiqueta: string;
  nombre: string;
  ayuda?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={estilos.campo}>
      <label htmlFor={nombre}>{etiqueta}</label>
      {children}
      {error ? (
        <span className={estilos.error} role="alert">
          {error}
        </span>
      ) : ayuda ? (
        <span className={estilos.ayuda}>{ayuda}</span>
      ) : null}
    </div>
  );
}
