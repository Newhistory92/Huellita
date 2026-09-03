import { notFound } from "next/navigation";
import { animalPorSlug, animalesPublicados, fotosDeAnimal } from "@/domains/animales/consultas";
import { urlDeFoto } from "@/domains/animales/fotos";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Foto } from "@/ui/componentes/Foto";
import { Pildora } from "@/ui/componentes/Pildora";
import { IconoPata } from "../IconoPata";
import { ESPECIE_EN_TEXTO, SEXO_EN_TEXTO, TAMANO_EN_TEXTO, TONO_POR_ESTADO, etiquetaEstado } from "../estado-texto";
import { Compartir } from "./Compartir";
import estilos from "./page.module.css";

export async function generateStaticParams() {
  const animales = await animalesPublicados({ soloPublicados: true });
  return animales.map((animal) => ({ slug: animal.slug }));
}

export default async function FichaAnimal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const animal = await animalPorSlug(slug);
  if (!animal) notFound();
  // Un animal adoptado o archivado SIGUE mostrando su ficha: los enlaces que
  // circularon por Facebook tienen que seguir funcionando (spec de diseño §6.2).

  const fotos = await fotosDeAnimal(animal.id);
  const principal = fotos.find((foto) => foto.principal) ?? fotos[0] ?? null;
  const secundarias = fotos.filter((foto) => foto.id !== principal?.id);

  const publicada = animal.publicadoEn
    ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(animal.publicadoEn)
    : null;

  return (
    <main className={estilos.contenedor}>
      <article className={estilos.stack}>
        <Card>
          <Foto
            alt={principal?.alt ?? `${animal.nombre}, todavía sin foto`}
            sensible={principal?.sensible ?? false}
            estilo={{ aspectRatio: "16/11" }}
            etiqueta={<Pildora tono={TONO_POR_ESTADO[animal.estado]}>{etiquetaEstado(animal)}</Pildora>}
          >
            {principal ? (
              // eslint-disable-next-line @next/next/no-img-element -- las medidas ya salen del pipeline de imágenes, no de Next
              <img src={urlDeFoto(principal.claveArchivo, 1024)} alt={principal.alt} />
            ) : (
              <IconoPata />
            )}
          </Foto>
          {secundarias.length > 0 && (
            <div className={estilos.miniaturas}>
              {secundarias.map((foto) => (
                <Foto key={foto.id} alt={foto.alt} sensible={foto.sensible} estilo={{ aspectRatio: "1", width: 64, flex: "none" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- las medidas ya salen del pipeline de imágenes, no de Next */}
                  <img src={urlDeFoto(foto.claveArchivo, 320)} alt={foto.alt} />
                </Foto>
              ))}
            </div>
          )}
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
