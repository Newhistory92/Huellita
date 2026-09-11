import Link from "next/link";
import { animalPorSlug } from "@/domains/animales/consultas";

export const metadata = { robots: { index: false, follow: true } };

export default async function Gracias({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const [{ slug }, { ref }] = await Promise.all([params, searchParams]);
  const animal = await animalPorSlug(slug);

  return (
    <main>
      <h1>Recibimos tu postulación</h1>
      {ref ? <p>Tu número de referencia es POST-{ref}. Guardalo por si nos llamás.</p> : null}

      {/* Sin plazo: la asociación son voluntarios y el plazo no lo controla
          el sistema. Prometer "en 48 horas" es prometer por otro. */}
      <p>
        Alguien del refugio va a leerla y se comunica con vos por teléfono o por correo.
        {animal ? ` Mientras tanto, la ficha de ${animal.nombre} sigue disponible.` : ""}
      </p>

      <Link href={`/adopcion/${slug}`}>Volver a la ficha</Link>
      <Link href="/adopcion">Ver otros animales en adopción</Link>
    </main>
  );
}
