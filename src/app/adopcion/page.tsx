import Link from "next/link";
import { animalesPublicados, filtroDesdeParametros, fotosDeAnimal } from "@/domains/animales/consultas";
import { urlDeFoto } from "@/domains/animales/fotos";
import { Boton } from "@/ui/componentes/Boton";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Foto } from "@/ui/componentes/Foto";
import { Pildora } from "@/ui/componentes/Pildora";
import { FiltrosAdopcion } from "./FiltrosAdopcion";
import { IconoPata } from "./IconoPata";
import { ESPECIE_EN_TEXTO, SEXO_EN_TEXTO, TAMANO_EN_TEXTO, TONO_POR_ESTADO, etiquetaEstado } from "./estado-texto";
import estilos from "./page.module.css";

export const metadata = { title: "Adoptar" };

export default async function Adopcion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;
  const filtro = filtroDesdeParametros(parametros);
  const animales = await animalesPublicados(filtro);
  const fotosPorAnimal = await Promise.all(animales.map((animal) => fotosDeAnimal(animal.id)));

  return (
    <main className={estilos.contenedor}>
      <div className={estilos.encabezado}>
        <p className={estilos.eyebrow}>/adopcion</p>
        <h1>Adoptar</h1>
        <p className={estilos.bajada}>
          Filtrá por lo que hoy podés ofrecer. La ficha de cada animal queda en línea para siempre, incluso
          después de la adopción.
        </p>
      </div>

      <Card>
        <CardCuerpo>
          <FiltrosAdopcion />
        </CardCuerpo>
      </Card>

      <p className={estilos.resultado} aria-live="polite">
        {animales.length === 1 ? "1 animal" : `${animales.length} animales`}
      </p>

      {animales.length === 0 ? (
        <Card>
          <CardCuerpo>
            <p className={estilos.vacio}>
              Ningún animal coincide con esos filtros. Probá ampliando el tamaño o el estado.
            </p>
          </CardCuerpo>
        </Card>
      ) : (
        <div className={estilos.grilla}>
          {animales.map((animal, indice) => {
            const fotos = fotosPorAnimal[indice];
            const principal = fotos.find((foto) => foto.principal) ?? fotos[0] ?? null;

            return (
              <Card key={animal.id} elevacion className={estilos.tarjeta}>
                <Foto
                  alt={principal?.alt ?? `${animal.nombre}, todavía sin foto`}
                  sensible={principal?.sensible ?? false}
                  etiqueta={<Pildora tono={TONO_POR_ESTADO[animal.estado]}>{etiquetaEstado(animal)}</Pildora>}
                >
                  {principal ? (
                    // eslint-disable-next-line @next/next/no-img-element -- las medidas ya salen del pipeline de imágenes, no de Next
                    <img src={urlDeFoto(principal, 640)} alt={principal.alt} />
                  ) : (
                    <IconoPata />
                  )}
                </Foto>
                <CardCuerpo>
                  <div>
                    <h3>{animal.nombre}</h3>
                    <p className={estilos.meta}>
                      {ESPECIE_EN_TEXTO[animal.especie]} · {TAMANO_EN_TEXTO[animal.tamano]} ·{" "}
                      {SEXO_EN_TEXTO[animal.sexo]}
                      {animal.zona ? ` · ${animal.zona}` : ""}
                    </p>
                  </div>
                  <p className={estilos.descripcion}>{animal.descripcion}</p>
                  <Link href={`/adopcion/${animal.slug}`}>
                    <Boton variante="fantasma" tamano="sm">
                      Ver la ficha de {animal.nombre}
                    </Boton>
                  </Link>
                </CardCuerpo>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
