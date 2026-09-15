"use client";

import { useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Boton } from "@/ui/componentes/Boton";
import { useToast } from "@/ui/componentes/Toast";
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
  const mostrarToast = useToast();

  function manejarError(error: unknown) {
    unstable_rethrow(error);
    mostrarToast(error instanceof Error ? error.message : "Ocurrió un error inesperado");
  }

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
            onClick={() =>
              iniciarTransicion(async () => {
                try {
                  await accionMarcarAnimal(animalId, "RESERVADO");
                } catch (error) {
                  manejarError(error);
                }
              })
            }
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
            onClick={() =>
              iniciarTransicion(async () => {
                try {
                  await accionMarcarAnimal(animalId, "ADOPTADO");
                } catch (error) {
                  manejarError(error);
                }
              })
            }
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
                try {
                  await accionCerrarOtras(animalId, postulacionId);
                } catch (error) {
                  manejarError(error);
                }
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
