"use client";

import { useState, useTransition } from "react";
import { Campo } from "@/ui/componentes/Campo";
import { Boton } from "@/ui/componentes/Boton";
import { accionCambiarEstado } from "../acciones";
import type { EstadoPostulacion } from "@/domains/postulaciones/tipos";
import { etiquetaEstado } from "@/ui/postulaciones/estado-texto";
import estilos from "./page.module.css";

const ESTADOS: EstadoPostulacion[] = [
  "NUEVA",
  "EN_REVISION",
  "CONTACTADA",
  "ENTREVISTA",
  "APROBADA",
  "RECHAZADA",
  "ADOPCION_CONCRETADA",
];

export function CambiarEstado({ id, estadoActual }: { id: string; estadoActual: EstadoPostulacion }) {
  const [estado, setEstado] = useState<EstadoPostulacion>(estadoActual);
  const [comentario, setComentario] = useState("");
  const [pendiente, iniciarTransicion] = useTransition();

  function enviar() {
    iniciarTransicion(async () => {
      await accionCambiarEstado(id, estado, comentario.trim() || null);
      setComentario("");
    });
  }

  return (
    <div className={estilos.formulario}>
      <Campo etiqueta="Estado" nombre="estado">
        <select
          id="estado"
          name="estado"
          value={estado}
          onChange={(evento) => setEstado(evento.target.value as EstadoPostulacion)}
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {etiquetaEstado(e)}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Comentario" nombre="comentario" ayuda="Opcional. Queda en el historial de la postulación.">
        <textarea
          id="comentario"
          name="comentario"
          value={comentario}
          onChange={(evento) => setComentario(evento.target.value)}
        />
      </Campo>
      <Boton
        type="button"
        variante="primario"
        disabled={pendiente || (estado === estadoActual && comentario.trim().length === 0)}
        onClick={enviar}
      >
        Guardar estado
      </Boton>
    </div>
  );
}
