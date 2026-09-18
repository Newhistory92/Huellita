"use client";

import { useRef, useState } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Boton } from "@/ui/componentes/Boton";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Campo } from "@/ui/componentes/Campo";
import { useToast } from "@/ui/componentes/Toast";
import { accionCrearNovedad } from "./acciones";
import estilos from "./Formulario.module.css";

export function Formulario({
  casos,
  animales,
}: {
  casos: { id: string; titulo: string }[];
  animales: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const mostrarToast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [casoId, setCasoId] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [publicando, setPublicando] = useState(false);

  return (
    <Card>
      <CardCuerpo>
        <h2>Publicar una novedad</h2>
        <form
          ref={formRef}
          className={estilos.forma}
          aria-busy={publicando}
          action={async (formulario) => {
            setPublicando(true);
            try {
              await accionCrearNovedad(formulario);
              formRef.current?.reset();
              setCasoId("");
              setAnimalId("");
              router.refresh();
              mostrarToast("Novedad publicada.");
            } catch (error) {
              unstable_rethrow(error);
              mostrarToast(error instanceof Error ? error.message : "Ocurrió un error inesperado");
            } finally {
              setPublicando(false);
            }
          }}
        >
          {/* El selector es excluyente acá, no solo en el dominio: si la pantalla
              dejara elegir los dos, el error llega recién al enviar y se pierde
              todo lo escrito. */}
          <div className={estilos.duenos}>
            <Campo etiqueta="Caso" nombre="casoId">
              <select
                id="casoId"
                name="casoId"
                value={casoId}
                disabled={animalId !== "" || publicando}
                onChange={(evento) => setCasoId(evento.target.value)}
              >
                <option value="">— Ninguno —</option>
                {casos.map((caso) => (
                  <option key={caso.id} value={caso.id}>
                    {caso.titulo}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="Animal" nombre="animalId">
              <select
                id="animalId"
                name="animalId"
                value={animalId}
                disabled={casoId !== "" || publicando}
                onChange={(evento) => setAnimalId(evento.target.value)}
              >
                <option value="">— Ninguno —</option>
                {animales.map((animal) => (
                  <option key={animal.id} value={animal.id}>
                    {animal.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo etiqueta="Título" nombre="titulo" ayuda="Hasta 120 caracteres.">
            <input id="titulo" name="titulo" maxLength={120} required disabled={publicando} />
          </Campo>

          <Campo etiqueta="Cuerpo" nombre="cuerpo" ayuda="Opcional, hasta 4000 caracteres.">
            <textarea id="cuerpo" name="cuerpo" maxLength={4000} rows={5} disabled={publicando} />
          </Campo>

          <Campo etiqueta="Foto" nombre="foto" ayuda="Opcional.">
            <input id="foto" name="foto" type="file" accept="image/png,image/jpeg,image/webp" disabled={publicando} />
          </Campo>

          <Campo etiqueta="Descripción de la foto" nombre="fotoAlt" ayuda="Obligatoria si adjuntás una foto.">
            <input id="fotoAlt" name="fotoAlt" disabled={publicando} />
          </Campo>

          <Campo etiqueta="Documento" nombre="documentoId" ayuda="Opcional: el identificador de un documento ya subido.">
            <input id="documentoId" name="documentoId" disabled={publicando} />
          </Campo>

          <Boton type="submit" variante="primario" disabled={publicando}>
            {publicando ? "Publicando…" : "Publicar novedad"}
          </Boton>
        </form>
      </CardCuerpo>
    </Card>
  );
}
