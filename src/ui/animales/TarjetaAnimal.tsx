import Link from "next/link";
import type { Animal, Foto as FotoDeAnimal } from "@/domains/animales/tipos";
import { urlDeFoto } from "@/domains/animales/fotos";
import { Boton } from "@/ui/componentes/Boton";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Foto } from "@/ui/componentes/Foto";
import { Pildora } from "@/ui/componentes/Pildora";
import { IconoPata } from "./IconoPata";
import { ESPECIE_EN_TEXTO, SEXO_EN_TEXTO, TAMANO_EN_TEXTO, TONO_POR_ESTADO, etiquetaEstado } from "./estado-texto";
import estilos from "./TarjetaAnimal.module.css";

/**
 * La tarjeta de un animal, tal como aparece en la portada y en el listado de
 * adopción. Vive acá y no dentro de una ruta porque la usan las dos: si cada
 * una tuviera la suya, la ficha de un animal se vería distinta según de dónde
 * venga la persona.
 */
export function TarjetaAnimal({
  animal,
  fotos,
  mostrarDescripcion = true,
}: {
  animal: Animal;
  fotos: FotoDeAnimal[];
  mostrarDescripcion?: boolean;
}) {
  const principal = fotos.find((foto) => foto.principal) ?? fotos[0] ?? null;

  return (
    <Card elevacion className={estilos.tarjeta}>
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
            {ESPECIE_EN_TEXTO[animal.especie]} · {TAMANO_EN_TEXTO[animal.tamano]} · {SEXO_EN_TEXTO[animal.sexo]}
            {animal.zona ? ` · ${animal.zona}` : ""}
          </p>
        </div>
        {mostrarDescripcion ? <p className={estilos.descripcion}>{animal.descripcion}</p> : null}
        <Link href={`/adopcion/${animal.slug}`}>
          <Boton variante="fantasma" tamano="sm">
            Ver la ficha de {animal.nombre}
          </Boton>
        </Link>
      </CardCuerpo>
    </Card>
  );
}
