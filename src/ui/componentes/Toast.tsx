"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import estilos from "./Toast.module.css";

type MostrarToast = (mensaje: string) => void;

const ContextoToast = createContext<MostrarToast | null>(null);

/**
 * Un solo toast a la vez, como en el prototipo aprobado. Queda más tiempo en
 * pantalla que en el prototipo (4s en vez de 2.4s) porque acá también avisa
 * errores del dominio, no solo confirmaciones cortas.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [activo, setActivo] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrarToast = useCallback<MostrarToast>((texto) => {
    setMensaje(texto);
    setActivo(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setActivo(false), 4000);
  }, []);

  return (
    <ContextoToast.Provider value={mostrarToast}>
      {children}
      <div className={`${estilos.toast} ${activo ? estilos.activo : ""}`} role="status" aria-live="polite">
        {mensaje}
      </div>
    </ContextoToast.Provider>
  );
}

/** Muestra un mensaje breve al pie de la pantalla. Para errores, para confirmaciones. */
export function useToast(): MostrarToast {
  const mostrarToast = useContext(ContextoToast);
  if (!mostrarToast) throw new Error("useToast tiene que usarse dentro de un ToastProvider");
  return mostrarToast;
}
