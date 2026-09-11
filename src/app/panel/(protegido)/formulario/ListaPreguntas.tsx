"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/ui/componentes/Boton";
import { Campo } from "@/ui/componentes/Campo";
import { Pildora } from "@/ui/componentes/Pildora";
import type { Pregunta, TipoRespuesta } from "@/domains/postulaciones/tipos";
import { accionCrearPregunta, accionEditarPregunta, accionArchivarPregunta, accionReordenar } from "./acciones";
import estilos from "./ListaPreguntas.module.css";

const TIPOS: { valor: TipoRespuesta; etiqueta: string }[] = [
  { valor: "TEXTO_CORTO", etiqueta: "Texto corto" },
  { valor: "TEXTO_LARGO", etiqueta: "Texto largo" },
  { valor: "SI_NO", etiqueta: "Sí o no" },
  { valor: "OPCION_MULTIPLE", etiqueta: "Opción múltiple (elige una)" },
  { valor: "SELECCION_MULTIPLE", etiqueta: "Selección múltiple (elige varias)" },
  { valor: "NUMERO", etiqueta: "Número" },
  { valor: "EMAIL", etiqueta: "Correo electrónico" },
  { valor: "TELEFONO", etiqueta: "Teléfono" },
];

/** Los únicos tipos que llevan una lista de opciones. Ver `validarOpciones` en el dominio. */
const TIPOS_CON_OPCIONES: TipoRespuesta[] = ["OPCION_MULTIPLE", "SELECCION_MULTIPLE"];

function etiquetaDeTipo(tipo: TipoRespuesta): string {
  return TIPOS.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}

function ordenarPorOrden(preguntas: Pregunta[]): Pregunta[] {
  return [...preguntas].sort((a, b) => a.orden - b.orden);
}

/**
 * Administra las preguntas de una familia: el formulario base (sin `animalId`)
 * o las propias de un animal. Se usa en las dos pantallas.
 */
export function ListaPreguntas({ preguntas, animalId }: { preguntas: Pregunta[]; animalId?: string }) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [tipoNuevo, setTipoNuevo] = useState<TipoRespuesta>("TEXTO_CORTO");

  const archivadas = ordenarPorOrden(preguntas.filter((p) => p.archivada));
  const [ordenActivas, setOrdenActivas] = useState(() =>
    ordenarPorOrden(preguntas.filter((p) => !p.archivada)).map((p) => p.id)
  );

  // Trae el orden nuevo desde el servidor: sin esto, después de un alta o un
  // archivado la lista local queda desactualizada hasta recargar a mano.
  useEffect(() => {
    setOrdenActivas(ordenarPorOrden(preguntas.filter((p) => !p.archivada)).map((p) => p.id));
  }, [preguntas]);

  const porId = new Map(preguntas.map((p) => [p.id, p]));
  const activas = ordenActivas.map((id) => porId.get(id)).filter((p): p is Pregunta => Boolean(p));

  function ejecutar(accion: () => Promise<void>) {
    iniciarTransicion(async () => {
      await accion();
      router.refresh();
    });
  }

  function moverA(id: string, destino: number) {
    if (destino < 0 || destino >= ordenActivas.length) return;
    const nuevoOrden = ordenActivas.filter((x) => x !== id);
    nuevoOrden.splice(destino, 0, id);
    setOrdenActivas(nuevoOrden);
    // El dominio exige el orden de toda la familia, activas y archivadas: las
    // archivadas se mandan al final, sin tocar su posición relativa.
    ejecutar(() => accionReordenar([...nuevoOrden, ...archivadas.map((p) => p.id)]));
  }

  function archivar(pregunta: Pregunta) {
    const confirma = window.confirm(
      `¿Archivar "${pregunta.texto}"? Deja de aparecer en el formulario; las postulaciones que ya la respondieron conservan el texto.`
    );
    if (!confirma) return;
    ejecutar(() => accionArchivarPregunta(pregunta.id));
  }

  return (
    <div className={estilos.contenedor} aria-busy={pendiente}>
      {activas.length === 0 ? (
        <p className={estilos.vacio}>Todavía no hay preguntas.</p>
      ) : (
        <ul className={estilos.lista}>
          {activas.map((pregunta, indice) =>
            editandoId === pregunta.id ? (
              <li key={pregunta.id} className={estilos.item}>
                <form
                  action={async (formulario) => {
                    await accionEditarPregunta(pregunta.id, formulario);
                    setEditandoId(null);
                    router.refresh();
                  }}
                  className={estilos.formularioEdicion}
                >
                  <Campo etiqueta="Pregunta" nombre={`texto-${pregunta.id}`}>
                    <input id={`texto-${pregunta.id}`} name="texto" defaultValue={pregunta.texto} required />
                  </Campo>
                  <Campo etiqueta="Ayuda" nombre={`ayuda-${pregunta.id}`} ayuda="Opcional.">
                    <input id={`ayuda-${pregunta.id}`} name="ayuda" defaultValue={pregunta.ayuda ?? ""} />
                  </Campo>
                  <label className={estilos.casilla}>
                    <input type="checkbox" name="obligatoria" defaultChecked={pregunta.obligatoria} />
                    Obligatoria
                  </label>
                  <p className={estilos.notaTipo}>
                    Tipo: {etiquetaDeTipo(pregunta.tipo)}. No se puede cambiar: archivá esta pregunta y creá otra si
                    necesitás otro tipo.
                  </p>
                  <div className={estilos.accionesFila}>
                    <Boton type="submit" variante="primario" tamano="sm">
                      Guardar
                    </Boton>
                    <Boton type="button" variante="fantasma" tamano="sm" onClick={() => setEditandoId(null)}>
                      Cancelar
                    </Boton>
                  </div>
                </form>
              </li>
            ) : (
              <li key={pregunta.id} className={estilos.item}>
                <div className={estilos.datos}>
                  <span className={estilos.texto}>{pregunta.texto}</span>
                  <span className={estilos.meta}>
                    {etiquetaDeTipo(pregunta.tipo)}
                    {pregunta.obligatoria ? <Pildora tono="marca">Obligatoria</Pildora> : null}
                  </span>
                  {pregunta.ayuda ? <span className={estilos.ayudaTexto}>{pregunta.ayuda}</span> : null}
                </div>
                <div className={estilos.controles}>
                  <div className={estilos.mover}>
                    <button
                      type="button"
                      aria-label={`Mover "${pregunta.texto}" antes`}
                      disabled={indice === 0}
                      onClick={() => moverA(pregunta.id, indice - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Mover "${pregunta.texto}" después`}
                      disabled={indice === activas.length - 1}
                      onClick={() => moverA(pregunta.id, indice + 1)}
                    >
                      ↓
                    </button>
                  </div>
                  <Boton type="button" variante="fantasma" tamano="sm" onClick={() => setEditandoId(pregunta.id)}>
                    Editar
                  </Boton>
                  <Boton type="button" variante="fantasma" tamano="sm" onClick={() => archivar(pregunta)}>
                    Archivar
                  </Boton>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {archivadas.length > 0 ? (
        <div className={estilos.archivadas}>
          <p className={estilos.notaArchivadas}>
            Archivadas: ya no aparecen en el formulario, pero las postulaciones que las respondieron conservan el
            texto de lo que se preguntó.
          </p>
          <ul className={estilos.lista}>
            {archivadas.map((pregunta) => (
              <li key={pregunta.id} className={`${estilos.item} ${estilos.itemArchivado}`}>
                <div className={estilos.datos}>
                  <span className={estilos.texto}>{pregunta.texto}</span>
                  <span className={estilos.meta}>{etiquetaDeTipo(pregunta.tipo)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        action={async (formulario) => {
          await accionCrearPregunta(formulario);
          setTipoNuevo("TEXTO_CORTO");
          router.refresh();
        }}
        className={estilos.formularioAlta}
      >
        {animalId ? <input type="hidden" name="animalId" value={animalId} /> : null}
        <Campo etiqueta="Pregunta nueva" nombre="texto">
          <input id="texto" name="texto" required />
        </Campo>
        <div className={estilos.fila}>
          <Campo etiqueta="Tipo de respuesta" nombre="tipo">
            <select
              id="tipo"
              name="tipo"
              value={tipoNuevo}
              onChange={(evento) => setTipoNuevo(evento.target.value as TipoRespuesta)}
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          <label className={estilos.casilla}>
            <input type="checkbox" name="obligatoria" />
            Obligatoria
          </label>
        </div>
        <Campo etiqueta="Ayuda" nombre="ayuda" ayuda="Opcional: un texto corto debajo de la pregunta.">
          <input id="ayuda" name="ayuda" />
        </Campo>
        {TIPOS_CON_OPCIONES.includes(tipoNuevo) ? (
          <Campo etiqueta="Opciones" nombre="opciones" ayuda="Una opción por línea. Hacen falta al menos dos.">
            <textarea id="opciones" name="opciones" rows={4} required />
          </Campo>
        ) : null}
        <Boton type="submit" variante="primario">
          Agregar pregunta
        </Boton>
      </form>
    </div>
  );
}
