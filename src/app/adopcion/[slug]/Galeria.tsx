"use client";

import { useState } from "react";
import { Foto } from "@/ui/componentes/Foto";
import { urlDeFoto } from "@/domains/animales/fotos";
import type { Foto as FotoDeAnimal } from "@/domains/animales/tipos";
import { IconoPata } from "../IconoPata";
import estilos from "./Galeria.module.css";

/** Las miniaturas nunca revelan una foto sensible: para verla hay que elegirla como la principal y abrir la compuerta ahí. */
export function Galeria({
  fotos,
  alt,
  etiqueta,
  indiceInicial = 0,
}: {
  fotos: FotoDeAnimal[];
  alt: string;
  etiqueta: React.ReactNode;
  indiceInicial?: number;
}) {
  const [indice, setIndice] = useState(indiceInicial);
  const actual = fotos[indice] ?? null;

  return (
    <>
      <Foto
        alt={actual?.alt ?? alt}
        sensible={actual?.sensible ?? false}
        estilo={{ aspectRatio: "16/11" }}
        etiqueta={etiqueta}
        meta={fotos.length > 1 ? `${indice + 1} / ${fotos.length}` : undefined}
      >
        {actual ? (
          // eslint-disable-next-line @next/next/no-img-element -- las medidas ya salen del pipeline de imágenes, no de Next
          <img src={urlDeFoto(actual.claveArchivo, 1024)} alt={actual.alt} />
        ) : (
          <IconoPata />
        )}
      </Foto>
      {fotos.length > 1 && (
        <div className={estilos.miniaturas}>
          {fotos.map((foto, i) => (
            <button
              key={foto.id}
              type="button"
              className={i === indice ? estilos.miniaturaActiva : estilos.miniatura}
              aria-label={`Ver la foto ${i + 1} de ${fotos.length}`}
              aria-pressed={i === indice}
              onClick={() => setIndice(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- las medidas ya salen del pipeline de imágenes, no de Next */}
              <img
                src={urlDeFoto(foto.claveArchivo, 320)}
                alt=""
                className={foto.sensible ? estilos.miniaturaSensible : undefined}
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
