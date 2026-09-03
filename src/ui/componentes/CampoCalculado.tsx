import estilos from "./CampoCalculado.module.css";

/**
 * Campo de solo lectura para valores que el sistema calcula (§11 del sistema
 * de diseño). En esta entrega no hay ninguno todavía: existe para que la
 * entrega 2 no tenga que inventarlo de nuevo.
 */
export function CampoCalculado({
  etiqueta,
  valor,
  explicacion,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  explicacion: string;
}) {
  return (
    <div className={estilos.campo}>
      <span className={estilos.etiqueta}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        {etiqueta}
      </span>
      <div className={estilos.valor}>{valor}</div>
      <span className={estilos.explicacion}>{explicacion}</span>
    </div>
  );
}
