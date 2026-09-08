"use client";

import { useState } from "react";
import { Card } from "@/ui/componentes/Card";
import { Importe } from "@/ui/finanzas/Importe";
import type { Asiento, Caso } from "@/domains/finanzas/tipos";
import estilos from "./Pestanas.module.css";

const PESTANAS = [
  { id: "resumen", etiqueta: "Resumen" },
  { id: "gastos", etiqueta: "Gastos" },
  { id: "libro", etiqueta: "Libro contable" },
] as const;

type IdPestana = (typeof PESTANAS)[number]["id"];

const FECHA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" });

export function Pestanas({
  caso,
  asientos,
  pendienteCentavos,
}: {
  caso: Caso;
  asientos: Asiento[];
  pendienteCentavos: bigint;
}) {
  const [activa, setActiva] = useState<IdPestana>("resumen");
  const gastos = asientos.filter((a) => a.tipo === "GASTO");
  const saldo = caso.recibidoCentavos - caso.gastadoCentavos;

  return (
    <Card>
      <div className={estilos.pestanas} role="tablist" aria-label="Secciones del caso">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            role="tab"
            id={`pestana-${p.id}`}
            aria-selected={activa === p.id}
            aria-controls={`panel-${p.id}`}
            className={activa === p.id ? estilos.activa : estilos.pestana}
            onClick={() => setActiva(p.id)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {activa === "resumen" && (
        <div role="tabpanel" id="panel-resumen" aria-labelledby="pestana-resumen" className={estilos.panel}>
          <h2>¿En qué se usó la plata?</h2>
          <dl className={estilos.resumen}>
            <div>
              <dt>Dinero recibido y verificado</dt>
              <dd>
                <Importe centavos={caso.recibidoCentavos} conSigno />
              </dd>
            </div>
            <div>
              <dt>Dinero gastado y documentado</dt>
              <dd>
                <Importe centavos={-caso.gastadoCentavos} conSigno />
              </dd>
            </div>
            <div>
              <dt>Saldo disponible del caso</dt>
              <dd>
                <Importe centavos={saldo} />
              </dd>
            </div>
          </dl>

          {pendienteCentavos > 0n && (
            <p className={estilos.pendiente}>
              Hay <Importe centavos={pendienteCentavos} /> en transferencias declaradas que todavía no
              verificamos contra el extracto bancario. <strong>No están contadas</strong> en el total de arriba.
            </p>
          )}
        </div>
      )}

      {activa === "gastos" && (
        <div role="tabpanel" id="panel-gastos" aria-labelledby="pestana-gastos" className={estilos.panel}>
          <h2>Gastos con comprobante</h2>
          {gastos.length === 0 ? (
            <p className={estilos.aclaracion}>Todavía no se registró ningún gasto en este caso.</p>
          ) : (
            <ul className={estilos.lista}>
              {gastos.map((gasto) => (
                <li key={gasto.id} className={estilos.fila}>
                  <div>
                    <strong>{gasto.descripcion}</strong>
                    <span className={estilos.meta}>{FECHA.format(gasto.fechaEfectiva)}</span>
                  </div>
                  <Importe centavos={gasto.centavos} conSigno />
                  {gasto.documentoId ? (
                    <a href={`/documentos/${gasto.documentoId}`}>Ver comprobante</a>
                  ) : (
                    // Un gasto sin respaldo se ve incompleto a propósito.
                    <span className={estilos.sinComprobante}>Sin comprobante adjunto</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activa === "libro" && (
        <div role="tabpanel" id="panel-libro" aria-labelledby="pestana-libro" className={estilos.panel}>
          <h2>Todos los movimientos</h2>
          <p className={estilos.aclaracion}>
            Cada línea es un asiento que no se modifica ni se borra. Si hubo un error, vas a ver la corrección
            como una línea nueva, con su motivo.
          </p>
          <ul className={estilos.lista}>
            {asientos.map((asiento) => (
              <li key={asiento.id} className={estilos.fila}>
                <div>
                  <strong>{asiento.descripcion}</strong>
                  <span className={estilos.meta}>
                    {FECHA.format(asiento.fechaEfectiva)}
                    {asiento.ajustaAId ? " · corrige un movimiento anterior" : ""}
                  </span>
                </div>
                <Importe centavos={asiento.centavos} conSigno />
                <span className={estilos.identificador}>{asiento.id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
