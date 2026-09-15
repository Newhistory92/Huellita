"use client";

import { useRef, useTransition, type FormEvent, type ReactNode } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useToast } from "./Toast";
import estilos from "./FormularioConToast.module.css";

/**
 * Envuelve un `<form>` ligado a una server action para que un error del
 * dominio salga como toast, no como la pantalla de error de Next.js, y para
 * que se note cuándo terminó de cargar. Mientras la acción está en curso, el
 * formulario queda atenuado y sin poder tocarse: sin eso no hay forma de
 * saber si el clic hizo algo. Si sale bien, se limpia y avisa con un toast;
 * si falla, deja lo que la persona escribió para que pueda corregir.
 */
export function FormularioConToast({
  accion,
  className,
  children,
  mensajeExito = "Se guardó.",
}: {
  accion: (formulario: FormData) => Promise<unknown>;
  className?: string;
  children: ReactNode;
  /** Pasá `null` para no avisar nada cuando sale bien (por ejemplo, si redirige a otra página). */
  mensajeExito?: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pendiente, iniciarTransicion] = useTransition();
  const mostrarToast = useToast();
  const router = useRouter();

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    iniciarTransicion(async () => {
      try {
        await accion(formulario);
        formRef.current?.reset();
        // Sin esto la pantalla queda con los datos viejos: llamar a la acción
        // directo (sin pasar por el action prop del <form>) no dispara sola
        // la actualización que sí dispara Next.js con un form nativo.
        router.refresh();
        if (mensajeExito) mostrarToast(mensajeExito);
      } catch (error) {
        unstable_rethrow(error);
        mostrarToast(error instanceof Error ? error.message : "Ocurrió un error inesperado");
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={alEnviar}
      className={`${estilos.forma} ${className ?? ""}`.trim()}
      aria-busy={pendiente}
    >
      <fieldset disabled={pendiente} className={estilos.campos}>
        {children}
      </fieldset>
    </form>
  );
}
