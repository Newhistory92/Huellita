"use client";

import { useTransition } from "react";
import { Boton } from "@/ui/componentes/Boton";
import { accionMarcarAnimal, accionCerrarOtras } from "../acciones";
import type { EstadoPostulacion } from "@/domains/postulaciones/tipos";
import estilos from "./page.module.css";

/**
 * Ofrece, no hace. El estado del animal y el cierre de las demás postulaciones
 * los decide una persona: un animal que figura como adoptado sin estarlo es un
 * error que se ve en público y que la asociación tiene que salir a explicar.
 *
 * Si nadie confirma, no pasa nada.
 */
export function Ofertas({
  estado,
  animalId,
  nombreAnimal,
  estadoAnimal,
  postulacionId,
  abiertasDelAnimal,
}: {
  estado: EstadoPostulacion;
  animalId: string;
  nombreAnimal: string;
  estadoAnimal: string;
  postulacionId: string;
  abiertasDelAnimal: number;
}) {
  const [pendiente, iniciarTransicion] = useTransition();

  const ofreceReservar = estado === "APROBADA" && estadoAnimal !== "RESERVADO";
  const ofreceAdoptado = estado === "ADOPCION_CONCRETADA" && estadoAnimal !== "ADOPTADO";
  const ofreceCerrar = estado === "ADOPCION_CONCRETADA" && abiertasDelAnimal > 0;

  if (!ofreceReservar && !ofreceAdoptado && !ofreceCerrar) return null;

  return (
    <aside className={estilos.ofertas}>
      {ofreceReservar && (
        <p>
          ¿Marcar a {nombreAnimal} como reservado?{" "}
          <Boton
            variante="fantasma"
            tamano="sm"
            disabled={pendiente}
            onClick={() => iniciarTransicion(() => accionMarcarAnimal(animalId, "RESERVADO"))}
          >
            Marcar como reservado
          </Boton>
        </p>
      )}

      {ofreceAdoptado && (
        <p>
          ¿Marcar a {nombreAnimal} como adoptado?{" "}
          <Boton
            variante="fantasma"
            tamano="sm"
            disabled={pendiente}
            onClick={() => iniciarTransicion(() => accionMarcarAnimal(animalId, "ADOPTADO"))}
          >
            Marcar como adoptado
          </Boton>
        </p>
      )}

      {ofreceCerrar && (
        <p>
          Hay {abiertasDelAnimal} {abiertasDelAnimal === 1 ? "postulación abierta" : "postulaciones abiertas"} para{" "}
          {nombreAnimal}. Si no se cierran, quedan en la bandeja para siempre.{" "}
          <Boton
            variante="fantasma"
            tamano="sm"
            disabled={pendiente}
            onClick={() =>
              iniciarTransicion(async () => {
                await accionCerrarOtras(animalId, postulacionId);
              })
            }
          >
            Rechazar las demás
          </Boton>
        </p>
      )}
    </aside>
  );
}
