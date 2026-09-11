import { Campo } from "@/ui/componentes/Campo";
import type { Pregunta } from "@/domains/postulaciones/tipos";
import estilos from "./CampoDePregunta.module.css";

/**
 * Un campo por tipo de pregunta. El nombre del campo es el identificador de
 * la pregunta: así la acción de envío arma el mapa de respuestas sin conocer
 * el formulario de antemano.
 */
export function CampoDePregunta({ pregunta }: { pregunta: Pregunta }) {
  const nombre = pregunta.id;
  const etiqueta = pregunta.obligatoria ? `${pregunta.texto} *` : pregunta.texto;

  if (pregunta.tipo === "TEXTO_LARGO") {
    return (
      <Campo etiqueta={etiqueta} nombre={nombre} ayuda={pregunta.ayuda ?? undefined}>
        <textarea id={nombre} name={nombre} required={pregunta.obligatoria} maxLength={4000} rows={5} />
      </Campo>
    );
  }

  if (pregunta.tipo === "SI_NO") {
    return (
      <fieldset className={estilos.grupo}>
        <legend>{etiqueta}</legend>
        {["sí", "no"].map((opcion) => (
          <label key={opcion} className={estilos.opcion}>
            <input type="radio" name={nombre} value={opcion} required={pregunta.obligatoria} />
            {opcion}
          </label>
        ))}
      </fieldset>
    );
  }

  if (pregunta.tipo === "OPCION_MULTIPLE" || pregunta.tipo === "SELECCION_MULTIPLE") {
    const multiple = pregunta.tipo === "SELECCION_MULTIPLE";
    return (
      <fieldset className={estilos.grupo}>
        <legend>{etiqueta}</legend>
        {pregunta.ayuda ? <p className={estilos.ayuda}>{pregunta.ayuda}</p> : null}
        {pregunta.opciones.map((opcion) => (
          <label key={opcion} className={estilos.opcion}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={nombre}
              value={opcion}
              required={pregunta.obligatoria && !multiple}
            />
            {opcion}
          </label>
        ))}
      </fieldset>
    );
  }

  const tipoDeCampo = { TEXTO_CORTO: "text", NUMERO: "number", EMAIL: "email", TELEFONO: "tel" }[
    pregunta.tipo as "TEXTO_CORTO" | "NUMERO" | "EMAIL" | "TELEFONO"
  ];

  return (
    <Campo etiqueta={etiqueta} nombre={nombre} ayuda={pregunta.ayuda ?? undefined}>
      <input id={nombre} name={nombre} type={tipoDeCampo} required={pregunta.obligatoria} maxLength={200} />
    </Campo>
  );
}
