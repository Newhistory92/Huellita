import type { Metadata } from "next";
import type { Caso } from "./tipos";

/** Recorta sin cortar una palabra al medio: mejor una descripción un poco más corta que una que termina a mitad de palabra. */
function recortar(texto: string, maximo = 160): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.lastIndexOf(" ", maximo - 1);
  return `${texto.slice(0, corte > 0 ? corte : maximo - 1)}…`;
}

export function metadatosDeCaso(caso: Caso): Metadata {
  return {
    title: caso.titulo,
    description: recortar(caso.situacion),
    alternates: { canonical: `/ayudar/${caso.slug}` },
    openGraph: {
      title: caso.titulo,
      description: recortar(caso.situacion),
      url: `/ayudar/${caso.slug}`,
      type: "article",
    },
  };
}
