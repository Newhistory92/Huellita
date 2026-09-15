"use client";

import { useState, useTransition } from "react";
import { Boton } from "@/ui/componentes/Boton";
import { accionBorrarDatosPersonales } from "../acciones";
import estilos from "./page.module.css";

/**
 * Pide confirmación antes de borrar: la acción no se puede deshacer, y una
 * vez hecha la postulación queda de solo lectura.
 */
export function BorrarDatosPersonales({ id }: { id: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, iniciarTransicion] = useTransition();

  if (!confirmando) {
    return (
      <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmando(true)}>
        Borrar datos personales
      </Boton>
    );
  }

  return (
    <div className={estilos.confirmacion}>
      <p>
        Se borra el nombre, el correo, el teléfono y el contenido de las respuestas. Queda el animal, la fecha y el
        estado en el que terminó, como estadística anónima. No se puede deshacer, y la postulación queda de solo
        lectura.
      </p>
      <div className={estilos.confirmacionAcciones}>
        <Boton
          variante="primario"
          tamano="sm"
          disabled={pendiente}
          onClick={() => iniciarTransicion(() => accionBorrarDatosPersonales(id))}
        >
          Confirmar borrado
        </Boton>
        <Boton variante="fantasma" tamano="sm" disabled={pendiente} onClick={() => setConfirmando(false)}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}
