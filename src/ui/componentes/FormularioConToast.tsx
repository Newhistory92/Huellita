"use client";

import { useRef, useTransition, type FormEvent, type ReactNode } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useToast } from "./Toast";

/**
 * Envuelve un `<form>` ligado a una server action para que un error del
 * dominio salga como toast, no como la pantalla de error de Next.js. Si la
 * acción sale bien, limpia el formulario; si falla, deja lo que la persona
 * escribió para que pueda corregir y reintentar.
 */
export function FormularioConToast({
  accion,
  className,
  children,
}: {
  accion: (formulario: FormData) => Promise<unknown>;
  className?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [, iniciarTransicion] = useTransition();
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
      } catch (error) {
        unstable_rethrow(error);
        mostrarToast(error instanceof Error ? error.message : "Ocurrió un error inesperado");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={alEnviar} className={className}>
      {children}
    </form>
  );
}
