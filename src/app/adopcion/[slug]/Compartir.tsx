"use client";

import { useState } from "react";
import estilos from "./Compartir.module.css";

/** Los enlaces de compartir se arman con window.location al hacer clic, nunca al renderizar: así el servidor y el cliente arrancan iguales. */
export function Compartir({ nombre }: { nombre: string }) {
  const [copiado, setCopiado] = useState(false);

  function compartirEnFacebook() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function compartirEnWhatsapp() {
    const texto = `${nombre}, en adopción: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className={estilos.barra}>
      <button className={estilos.compartir} onClick={compartirEnFacebook}>
        Facebook
      </button>
      <button className={estilos.compartir} onClick={compartirEnWhatsapp}>
        WhatsApp
      </button>
      <button className={estilos.compartir} onClick={copiarLink}>
        {copiado ? "¡Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}
