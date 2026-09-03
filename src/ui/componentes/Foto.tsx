"use client";

import { useState } from "react";
import estilos from "./Foto.module.css";
import { CompuertaSensible } from "./CompuertaSensible";

export function Foto({
  alt,
  sensible = false,
  tituloSensible = "Imagen sensible",
  aclaracionSensible = "Puede mostrar al animal lastimado o en tratamiento.",
  etiqueta,
  meta,
  children,
}: {
  alt: string;
  sensible?: boolean;
  tituloSensible?: string;
  aclaracionSensible?: string;
  etiqueta?: React.ReactNode;
  meta?: string;
  children: React.ReactNode;
}) {
  const [revelada, setRevelada] = useState(false);
  const mostrarCompuerta = sensible && !revelada;

  const clases = [estilos.foto, mostrarCompuerta ? estilos.sensible : ""].join(" ").trim();

  return (
    <div className={clases} role="img" aria-label={alt}>
      {children}
      {etiqueta ? <span className={estilos.etiqueta}>{etiqueta}</span> : null}
      {meta ? <span className={estilos.meta}>{meta}</span> : null}
      {mostrarCompuerta ? (
        <CompuertaSensible titulo={tituloSensible} aclaracion={aclaracionSensible} onRevelar={() => setRevelada(true)} />
      ) : null}
    </div>
  );
}
