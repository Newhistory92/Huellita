import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  casoPorSlug,
  casosPublicos,
  libroDeCaso,
  pendienteDeCaso,
  porcentajeDeAvance,
  faltaParaLaMeta,
} from "@/domains/finanzas/consultas";
import { metadatosDeCaso } from "@/domains/finanzas/metadatos";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Pildora } from "@/ui/componentes/Pildora";
import { Boton } from "@/ui/componentes/Boton";
import { Medidor } from "@/ui/finanzas/Medidor";
import { Pestanas } from "./Pestanas";
import estilos from "./page.module.css";

const ESTADO_EN_PILDORA = {
  ABIERTO: { tono: "warn", texto: "Abierto" },
  META_ALCANZADA: { tono: "warn", texto: "Meta alcanzada" },
  CERRADO: { tono: "ok", texto: "Cerrado" },
} as const;

export async function generateStaticParams() {
  const casos = await casosPublicos({});
  return casos.map((caso) => ({ slug: caso.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const caso = await casoPorSlug(slug);
  if (!caso) return {};
  return metadatosDeCaso(caso);
}

export default async function Caso({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caso = await casoPorSlug(slug);
  if (!caso) notFound();
  // Un caso cerrado sigue publicado para siempre: el enlace que circuló por
  // Facebook tiene que seguir respondiendo (spec de diseño §6.1).

  const asientos = await libroDeCaso(caso.id);
  const pendiente = await pendienteDeCaso(caso.id);
  const pildora = ESTADO_EN_PILDORA[caso.estado];

  return (
    <main className={estilos.contenedor}>
      <article className={estilos.stack}>
        <div className={estilos.encabezado}>
          <div className={estilos.linea}>
            <p className={estilos.eyebrow}>/ayudar/{caso.slug}</p>
            <Pildora tono={pildora.tono}>{pildora.texto}</Pildora>
          </div>
          {/* El orden lo fija la §6.1 del sistema de diseño: quién es, qué le
              pasó, cómo ayudo. Responder las tres antes de cualquier scroll. */}
          <h1>{caso.titulo}</h1>
          <p className={estilos.bajada}>{caso.situacion}</p>
        </div>

        <Card>
          <CardCuerpo>
            <Medidor
              recibidoCentavos={caso.recibidoCentavos}
              metaCentavos={caso.metaCentavos}
              avance={porcentajeDeAvance(caso)}
              falta={faltaParaLaMeta(caso)}
              cantidadDonaciones={caso.cantidadDonantes}
            />
            {caso.estado !== "CERRADO" ? (
              <Link href={`/ayudar/${caso.slug}/donar`}>
                <Boton variante="donar">Donar ahora</Boton>
              </Link>
            ) : null}
          </CardCuerpo>
        </Card>

        <Pestanas caso={caso} asientos={asientos} pendienteCentavos={pendiente} />

        <div className={estilos.confianza}>
          <p className={estilos.eyebrow}>Por qué podés confiar en este número</p>
          <p className={estilos.textoConfianza}>
            Lo recibido es la suma de {caso.cantidadDonantes}{" "}
            {caso.cantidadDonantes === 1 ? "donación confirmada" : "donaciones confirmadas"}: pagos que el
            proveedor aprobó o transferencias que alguien del refugio verificó contra el extracto bancario. Un
            pago rechazado, cancelado o duplicado no suma, y nadie puede editar el total: solo se agregan
            movimientos nuevos.
          </p>
        </div>
      </article>
    </main>
  );
}
