import Link from "next/link";
import { notFound } from "next/navigation";
import { casoPorSlug } from "@/domains/finanzas/consultas";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import estilos from "./page.module.css";

export default async function GraciasPorDonar({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caso = await casoPorSlug(slug);
  if (!caso) notFound();

  return (
    <main className={estilos.contenedor}>
      <Card>
        <CardCuerpo>
          {/* No afirma que la donación entró: el estado real lo define el aviso
              verificado, que puede tardar. Mostrar esto como confirmado sería
              exactamente lo que la plataforma promete no hacer. */}
          <h1>¡Gracias!</h1>
          <p className={estilos.texto}>
            Tu pago se está confirmando con Mercado Pago. En cuanto quede verificado, el monto recaudado de{" "}
            <strong>{caso.titulo}</strong> se actualiza solo.
          </p>
          <Link href={`/ayudar/${caso.slug}`} className={estilos.volver}>
            Volver al caso
          </Link>
        </CardCuerpo>
      </Card>
    </main>
  );
}
