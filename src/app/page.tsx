import Link from "next/link";
import { Boton } from "@/ui/componentes/Boton";
import estilos from "./page.module.css";

export default function Inicio() {
  return (
    <main className={estilos.contenedor}>
      <p className={estilos.eyebrow}>Huellas</p>
      <h1>Cada rescate tiene una dirección que no caduca.</h1>
      <p className={estilos.bajada}>
        Adopciones con ficha permanente y transparencia de en qué se gastó cada peso donado.
      </p>
      <Link href="/adopcion">
        <Boton>Ver animales en adopción</Boton>
      </Link>
    </main>
  );
}
