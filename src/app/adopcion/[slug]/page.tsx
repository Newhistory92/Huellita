import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { animalPorSlug, animalesPublicados, fotosDeAnimal, slugActualDe } from "@/domains/animales/consultas";
import { metadatosDeAnimal } from "@/domains/animales/metadatos";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Pildora } from "@/ui/componentes/Pildora";
import { ESPECIE_EN_TEXTO, SEXO_EN_TEXTO, TAMANO_EN_TEXTO, TONO_POR_ESTADO, etiquetaEstado } from "../estado-texto";
import { Compartir } from "./Compartir";
import { Galeria } from "./Galeria";
import estilos from "./page.module.css";

export async function generateStaticParams() {
  const animales = await animalesPublicados({ soloPublicados: true });
  return animales.map((animal) => ({ slug: animal.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const animal = await animalPorSlug(slug);
  if (!animal) return {};
  return metadatosDeAnimal(animal);
}

export default async function FichaAnimal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const animal = await animalPorSlug(slug);
  if (!animal) {
    // Una dirección que circuló por Facebook nunca puede terminar en 404: si el nombre
    // se corrigió, la redirección lleva a la dirección actual con código 308.
    const actual = await slugActualDe(slug);
    if (actual) permanentRedirect(`/adopcion/${actual}`);
    notFound();
  }
  // Un animal adoptado o archivado SIGUE mostrando su ficha: los enlaces que
  // circularon por Facebook tienen que seguir funcionando (spec de diseño §6.2).

  const fotos = await fotosDeAnimal(animal.id);
  const indicePrincipal = fotos.findIndex((foto) => foto.principal);

  // La caché de unstable_cache serializa a JSON entre builds: publicadoEn puede llegar como texto, no como Date.
  const publicada = animal.publicadoEn
    ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(animal.publicadoEn))
    : null;

  return (
    <main className={estilos.contenedor}>
      <article className={estilos.stack}>
        <Card>
          <Galeria
            fotos={fotos}
            alt={`${animal.nombre}, todavía sin foto`}
            etiqueta={<Pildora tono={TONO_POR_ESTADO[animal.estado]}>{etiquetaEstado(animal)}</Pildora>}
            indiceInicial={indicePrincipal >= 0 ? indicePrincipal : 0}
          />
        </Card>

        <div className={estilos.encabezado}>
          <p className={estilos.eyebrow}>
            /adopcion/{animal.slug}
            {publicada ? ` · publicado el ${publicada}` : ""}
          </p>
          <h1>{animal.nombre}</h1>
          <p className={estilos.bajada}>{animal.descripcion}</p>
        </div>

        <dl className={estilos.datagrid}>
          <div>
            <dt>Especie</dt>
            <dd>{ESPECIE_EN_TEXTO[animal.especie]}</dd>
          </div>
          <div>
            <dt>Sexo</dt>
            <dd>{SEXO_EN_TEXTO[animal.sexo]}</dd>
          </div>
          <div>
            <dt>Tamaño</dt>
            <dd>{TAMANO_EN_TEXTO[animal.tamano]}</dd>
          </div>
          <div>
            <dt>Castrado</dt>
            <dd>{animal.castrado ? "Sí" : "No"}</dd>
          </div>
          <div>
            <dt>Vacunas</dt>
            <dd>{animal.vacunasAlDia ? "Al día" : "No"}</dd>
          </div>
          {animal.zona && (
            <div>
              <dt>Zona</dt>
              <dd>{animal.zona}</dd>
            </div>
          )}
        </dl>

        {animal.personalidad && (
          <Card>
            <CardCuerpo>
              <h2>Cómo es</h2>
              <p>{animal.personalidad}</p>
            </CardCuerpo>
          </Card>
        )}

        {animal.requisitos && (
          <Card>
            <CardCuerpo>
              <h2>Requisitos para adoptarlo</h2>
              <p>{animal.requisitos}</p>
            </CardCuerpo>
          </Card>
        )}

        <Compartir nombre={`${animal.nombre} — ${ESPECIE_EN_TEXTO[animal.especie]} en adopción`} />
      </article>
    </main>
  );
}
