import { urlDeFoto } from "@/domains/animales/fotos";
import type { Novedad } from "@/domains/novedades/tipos";
import estilos from "./ListaDeNovedades.module.css";

const FECHA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Se usa en la pestaña del caso y en la ficha del animal. Vive acá y no dentro
 * de una ruta porque las dos la muestran igual: una novedad no debería verse
 * distinta según desde dónde se la mire.
 */
export function ListaDeNovedades({ novedades, vacio }: { novedades: Novedad[]; vacio: string }) {
  if (novedades.length === 0) return <p className={estilos.vacio}>{vacio}</p>;

  return (
    <ol className={estilos.lista}>
      {novedades.map((novedad) => (
        <li key={novedad.id} className={estilos.novedad}>
          <time className={estilos.fecha} dateTime={novedad.creadoEn.toISOString()}>
            {FECHA.format(novedad.creadoEn)}
          </time>
          <h3 className={estilos.titulo}>{novedad.titulo}</h3>
          {novedad.cuerpo ? <p className={estilos.cuerpo}>{novedad.cuerpo}</p> : null}

          {novedad.foto ? (
            <figure className={estilos.figura}>
              {/* eslint-disable-next-line @next/next/no-img-element -- las medidas ya salen del pipeline de imágenes, no de Next */}
              <img
                src={urlDeFoto({ claveArchivo: novedad.foto.clave, ancho: novedad.foto.ancho }, 640)}
                alt={novedad.foto.alt}
                width={novedad.foto.ancho}
                height={novedad.foto.alto}
                loading="lazy"
              />
            </figure>
          ) : null}

          {novedad.documentoId ? (
            <a className={estilos.documento} href={`/documentos/${novedad.documentoId}`}>
              Ver el documento adjunto
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
