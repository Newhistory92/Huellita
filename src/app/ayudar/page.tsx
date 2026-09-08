import Link from "next/link";
import { casosPublicos, porcentajeDeAvance, faltaParaLaMeta } from "@/domains/finanzas/consultas";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Medidor } from "@/ui/finanzas/Medidor";
import estilos from "./page.module.css";

export const metadata = { title: "Ayudar" };

export default async function Ayudar() {
  const casos = await casosPublicos({ soloAbiertos: true });

  return (
    <main className={estilos.contenedor}>
      <div className={estilos.encabezado}>
        <p className={estilos.eyebrow}>/ayudar</p>
        <h1>Casos abiertos ahora</h1>
        <p className={estilos.bajada}>
          Cada caso tiene su propia dirección permanente y su propio libro contable: una donación para un
          animal nunca puede terminar contada en el caso de otro.
        </p>
      </div>

      {casos.length === 0 ? (
        <Card>
          <CardCuerpo>
            <p className={estilos.vacio}>No hay casos abiertos en este momento.</p>
          </CardCuerpo>
        </Card>
      ) : (
        <div className={estilos.lista}>
          {casos.map((caso) => (
            <Card key={caso.id} elevacion>
              <CardCuerpo>
                <Link href={`/ayudar/${caso.slug}`} className={estilos.titulo}>
                  {caso.titulo}
                </Link>
                <p className={estilos.situacion}>{caso.situacion}</p>
                <Medidor
                  recibidoCentavos={caso.recibidoCentavos}
                  metaCentavos={caso.metaCentavos}
                  avance={porcentajeDeAvance(caso)}
                  falta={faltaParaLaMeta(caso)}
                  cantidadDonaciones={caso.cantidadDonantes}
                />
              </CardCuerpo>
            </Card>
          ))}
        </div>
      )}

      <p className={estilos.pie}>
        ¿Buscás la rendición de cuentas completa? Mirá la <Link href="/transparencia">transparencia</Link> de
        la asociación.
      </p>
    </main>
  );
}
