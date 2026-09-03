"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Chip } from "@/ui/componentes/Chip";
import type { EstadoAnimal } from "@/domains/animales/tipos";
import estilos from "./FiltroEstado.module.css";

const ESTADOS: EstadoAnimal[] = [
  "BORRADOR",
  "DISPONIBLE",
  "EN_EVALUACION",
  "RESERVADO",
  "ADOPTADO",
  "TRANSITO",
  "TRATAMIENTO",
  "NO_DISPONIBLE",
  "FALLECIDO",
];

export function FiltroEstado() {
  const router = useRouter();
  const parametros = useSearchParams();
  const actual = parametros.get("estado");

  function elegir(estado: string | null) {
    router.push(estado ? `/panel/animales?estado=${estado}` : "/panel/animales");
  }

  return (
    <div className={estilos.filtros}>
      <Chip presionado={!actual} onClick={() => elegir(null)}>
        Todos
      </Chip>
      {ESTADOS.map((estado) => (
        <Chip key={estado} presionado={actual === estado} onClick={() => elegir(estado)}>
          {estado}
        </Chip>
      ))}
    </div>
  );
}
