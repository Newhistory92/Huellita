"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Chip } from "@/ui/componentes/Chip";
import estilos from "./FiltrosAdopcion.module.css";

type Clave = "tamano" | "especie" | "estado";

const GRUPOS: Array<{ clave: Clave; titulo: string; opciones: Array<{ valor: string; etiqueta: string }> }> = [
  {
    clave: "tamano",
    titulo: "Tamaño",
    opciones: [
      { valor: "pequeno", etiqueta: "Pequeño" },
      { valor: "mediano", etiqueta: "Mediano" },
      { valor: "grande", etiqueta: "Grande" },
    ],
  },
  {
    clave: "especie",
    titulo: "Especie",
    opciones: [
      { valor: "perro", etiqueta: "Perro" },
      { valor: "gato", etiqueta: "Gato" },
    ],
  },
  {
    clave: "estado",
    titulo: "Estado",
    opciones: [
      { valor: "disponible", etiqueta: "Disponible" },
      { valor: "adoptado", etiqueta: "Adoptado" },
    ],
  },
];

/** Los filtros viajan en la dirección, no en el estado del componente: así el enlace filtrado se puede compartir. */
export function FiltrosAdopcion() {
  const router = useRouter();
  const parametros = useSearchParams();

  function elegir(clave: Clave, valor: string | null) {
    const siguientes = new URLSearchParams(parametros.toString());
    if (valor) siguientes.set(clave, valor);
    else siguientes.delete(clave);
    const consulta = siguientes.toString();
    router.push(consulta ? `/adopcion?${consulta}` : "/adopcion");
  }

  return (
    <>
      {GRUPOS.map(({ clave, titulo, opciones }) => {
        const actual = parametros.get(clave);
        return (
          <fieldset key={clave} className={estilos.grupo}>
            <legend className={estilos.leyenda}>{titulo}</legend>
            <div className={estilos.chips} role="group" aria-label={`Filtrar por ${titulo.toLowerCase()}`}>
              <Chip presionado={!actual} onClick={() => elegir(clave, null)}>
                Todos
              </Chip>
              {opciones.map((opcion) => (
                <Chip key={opcion.valor} presionado={actual === opcion.valor} onClick={() => elegir(clave, opcion.valor)}>
                  {opcion.etiqueta}
                </Chip>
              ))}
            </div>
          </fieldset>
        );
      })}
    </>
  );
}
