import type { Metadata } from "next";
import type { Animal } from "./tipos";

const ESPECIE_EN_TEXTO = { PERRO: "Perro", GATO: "Gato", OTRO: "Animal" } as const;

/** Recorta sin cortar una palabra al medio: mejor una descripción un poco más corta que una que termina a mitad de palabra. */
function recortar(texto: string, maximo = 160): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.lastIndexOf(" ", maximo - 1);
  return `${texto.slice(0, corte > 0 ? corte : maximo - 1)}…`;
}

export function metadatosDeAnimal(animal: Animal): Metadata {
  const titulo =
    animal.estado === "ADOPTADO"
      ? `${animal.nombre} — Adoptado`
      : `${animal.nombre} — ${ESPECIE_EN_TEXTO[animal.especie]} en adopción`;

  return {
    title: titulo,
    description: recortar(animal.descripcion),
    alternates: { canonical: `/adopcion/${animal.slug}` },
    openGraph: {
      title: titulo,
      description: recortar(animal.descripcion),
      url: `/adopcion/${animal.slug}`,
      type: "article",
    },
  };
}
