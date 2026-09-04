import Link from "next/link";
import { animalesPublicados, filtroDesdeParametros, fotosDeAnimal } from "@/domains/animales/consultas";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { FiltrosAdopcion } from "./FiltrosAdopcion";
import { TarjetaAnimal } from "@/ui/animales/TarjetaAnimal";
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
          {animales.map((animal, indice) => (
            <TarjetaAnimal key={animal.id} animal={animal} fotos={fotosPorAnimal[indice]} />
          ))}
        </div>
      )}
    </main>
  );
}
