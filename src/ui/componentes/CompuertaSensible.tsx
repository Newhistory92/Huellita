import estilos from "./CompuertaSensible.module.css";

/**
 * Implementa el §5.11 del sistema de diseño: la persona decide si quiere ver
 * una imagen marcada como sensible. No guarda la decisión en ningún lado —
 * cada carga de página vuelve a mostrar la compuerta.
 */
export function CompuertaSensible({
  titulo,
  aclaracion,
  onRevelar,
}: {
  titulo: string;
  aclaracion: string;
  onRevelar: () => void;
}) {
  return (
    <button type="button" className={estilos.compuerta} onClick={onRevelar}>
      <span className={estilos.icono} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      <strong>{titulo}</strong>
      <small>{aclaracion}</small>
    </button>
  );
}
