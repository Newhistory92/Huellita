"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/ui/componentes/Boton";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Campo } from "@/ui/componentes/Campo";
import { Foto } from "@/ui/componentes/Foto";
import type { Foto as FotoDeAnimal } from "@/domains/animales/tipos";
import { accionSubirFoto, accionReordenarFotos, accionMarcarSensible, accionDefinirPrincipal } from "./acciones-fotos";
import estilos from "./fotos.module.css";

function urlMiniatura(claveArchivo: string): string {
  return `/archivos/${claveArchivo}-320.webp`;
}

export function Fotos({ animalId, fotos }: { animalId: string; fotos: FotoDeAnimal[] }) {
  const router = useRouter();
  const [orden, setOrden] = useState(fotos.map((f) => f.id));
  const [arrastrada, setArrastrada] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  // router.refresh() trae fotos nuevas desde el servidor: sin esto, el
  // estado local se queda con la lista vieja y la foto recién subida no
  // aparece hasta recargar la página a mano.
  useEffect(() => {
    setOrden(fotos.map((f) => f.id));
  }, [fotos]);

  const porId = new Map(fotos.map((f) => [f.id, f]));
  const ordenadas = orden.map((id) => porId.get(id)).filter((f): f is FotoDeAnimal => Boolean(f));

  function ejecutar(accion: () => Promise<void>) {
    iniciarTransicion(async () => {
      await accion();
      router.refresh();
    });
  }

  function moverA(id: string, destino: number) {
    if (destino < 0 || destino >= orden.length) return;
    const nuevoOrden = orden.filter((x) => x !== id);
    nuevoOrden.splice(destino, 0, id);
    setOrden(nuevoOrden);
    ejecutar(() => accionReordenarFotos(animalId, nuevoOrden));
  }

  function alSoltar(idDestino: string) {
    if (!arrastrada || arrastrada === idDestino) return;
    moverA(arrastrada, orden.indexOf(idDestino));
    setArrastrada(null);
  }

  return (
    <Card>
      <CardCuerpo>
        <h2>Fotos</h2>

        {ordenadas.length === 0 ? (
          <p className={estilos.vacio}>Todavía no tiene fotos.</p>
        ) : (
          <ul className={estilos.grilla} aria-busy={pendiente}>
            {ordenadas.map((foto, indice) => (
              <li
                key={foto.id}
                className={estilos.item}
                draggable
                onDragStart={() => setArrastrada(foto.id)}
                onDragOver={(evento) => evento.preventDefault()}
                onDrop={() => alSoltar(foto.id)}
              >
                <Foto alt={foto.alt} sensible={foto.sensible} etiqueta={foto.principal ? "Principal" : undefined}>
                  <img src={urlMiniatura(foto.claveArchivo)} alt={foto.alt} />
                </Foto>

                <div className={estilos.controles}>
                  <div className={estilos.mover}>
                    <button
                      type="button"
                      aria-label={`Mover "${foto.alt}" antes`}
                      disabled={indice === 0}
                      onClick={() => moverA(foto.id, indice - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Mover "${foto.alt}" después`}
                      disabled={indice === ordenadas.length - 1}
                      onClick={() => moverA(foto.id, indice + 1)}
                    >
                      ↓
                    </button>
                  </div>

                  <label className={estilos.casilla}>
                    <input
                      type="checkbox"
                      checked={foto.sensible}
                      onChange={(evento) => ejecutar(() => accionMarcarSensible(foto.id, evento.target.checked))}
                    />
                    Puede impresionar
                  </label>

                  <button type="button" disabled={foto.principal} onClick={() => ejecutar(() => accionDefinirPrincipal(foto.id))}>
                    {foto.principal ? "Es la principal" : "Definir como principal"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          action={async (formulario) => {
            await accionSubirFoto(animalId, formulario);
            router.refresh();
          }}
          className={estilos.subida}
        >
          <Campo etiqueta="Nuevas fotos" nombre="archivo" ayuda="Podés elegir varias a la vez.">
            <input id="archivo" name="archivo" type="file" accept="image/png,image/jpeg,image/webp" multiple required />
          </Campo>
          <Campo
            etiqueta="Descripción de la imagen"
            nombre="alt"
            ayuda="Obligatoria: la necesita quien no puede ver la foto. Si subís varias, se numera automáticamente."
          >
            <input id="alt" name="alt" required />
          </Campo>
          <label className={estilos.casilla}>
            <input type="checkbox" name="sensible" />
            Esta imagen puede impresionar
          </label>
          <Boton type="submit" variante="primario">
            Subir fotos
          </Boton>
        </form>
      </CardCuerpo>
    </Card>
  );
}
