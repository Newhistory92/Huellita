import { Importe } from "./Importe";
import estilos from "./Medidor.module.css";

export function Medidor({
  recibidoCentavos,
  metaCentavos,
  avance,
  falta,
  cantidadDonaciones,
}: {
  recibidoCentavos: bigint;
  metaCentavos: bigint;
  avance: number;
  falta: bigint;
  cantidadDonaciones: number;
}) {
  return (
    <div className={estilos.medidor}>
      <Importe centavos={recibidoCentavos} tamano="grande" />

      <div
        className={estilos.riel}
        role="progressbar"
        aria-valuenow={avance}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance de la recaudación"
      >
        <div className={estilos.relleno} style={{ width: `${avance}%` }} />
      </div>

      <div className={estilos.pie}>
        <span>
          Meta <Importe centavos={metaCentavos} />
        </span>
        <span>
          {falta > 0n ? <>Faltan <Importe centavos={falta} /></> : "Meta alcanzada"} ·{" "}
          {/* Son donaciones, no personas: sin pedir identificación no hay forma
              de saber si dos vinieron de la misma. */}
          {cantidadDonaciones} {cantidadDonaciones === 1 ? "donación" : "donaciones"}
        </span>
      </div>
    </div>
  );
}
