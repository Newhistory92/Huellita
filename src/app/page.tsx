import Link from "next/link";
import { animalesPublicados, fotosDeAnimal } from "@/domains/animales/consultas";
import { Boton } from "@/ui/componentes/Boton";
import { TarjetaAnimal } from "@/ui/animales/TarjetaAnimal";
import estilos from "./page.module.css";

/** Cuántos animales asoman en la portada antes de mandar al listado completo. */
const CUANTOS_EN_PORTADA = 3;

export default async function Inicio() {
  const disponibles = await animalesPublicados({ soloPublicados: true, estado: "DISPONIBLE" });
  const destacados = disponibles.slice(0, CUANTOS_EN_PORTADA);
  const fotosPorAnimal = await Promise.all(destacados.map((animal) => fotosDeAnimal(animal.id)));

  return (
    <main className={estilos.contenedor}>
      <section className={estilos.presentacion}>
        <p className={estilos.eyebrow}>Huellas</p>
        <h1>Cada rescate tiene una dirección que no caduca.</h1>
        <p className={estilos.bajada}>
          Adopciones con ficha permanente y transparencia de en qué se gastó cada peso donado.
        </p>
        <Link href="/adopcion">
          <Boton>Ver animales en adopción</Boton>
        </Link>
      </section>

      {destacados.length > 0 && (
        <section className={estilos.seccion} aria-labelledby="buscan-familia">
          <div className={estilos.encabezado}>
            <h2 id="buscan-familia">Buscan familia</h2>
            <Link href="/adopcion">
              <Boton variante="fantasma" tamano="sm">
                Ver todos
              </Boton>
            </Link>
          </div>
          <div className={estilos.grilla}>
            {destacados.map((animal, indice) => (
              <TarjetaAnimal
                key={animal.id}
                animal={animal}
                fotos={fotosPorAnimal[indice]}
                mostrarDescripcion={false}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
