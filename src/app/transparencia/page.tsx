import Link from "next/link";
import { casosPublicos, totalesGenerales } from "@/domains/finanzas/consultas";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Pildora } from "@/ui/componentes/Pildora";
import { Importe } from "@/ui/finanzas/Importe";
import estilos from "./page.module.css";

export const metadata = { title: "Transparencia" };

const ESTADO_EN_PILDORA = {
  ABIERTO: { tono: "warn", texto: "Abierto" },
  META_ALCANZADA: { tono: "warn", texto: "Meta alcanzada" },
  CERRADO: { tono: "ok", texto: "Cerrado" },
} as const;

const METODOLOGIA = [
  "Cada caso tiene su propio destino de cobro: una donación para un animal nunca puede terminar contada en el caso de otro.",
  "Cuando el proveedor de pagos confirma un pago, avisa al sitio. El sitio le vuelve a preguntar al proveedor si ese pago existe y está aprobado, antes de contarlo.",
  "Si el mismo aviso llega dos veces, se cuenta una sola vez.",
  "Las transferencias por CBU no suman hasta que una persona del refugio las verifica contra el extracto bancario.",
  "Nadie puede editar el total. Solo se pueden agregar movimientos, y cada movimiento queda con autor, fecha y motivo.",
  "Un error se corrige con un ajuste visible, nunca borrando el historial.",
];

export default async function Transparencia() {
  const [totales, casos] = await Promise.all([totalesGenerales(), casosPublicos({})]);

  return (
    <main className={estilos.contenedor}>
      <div className={estilos.encabezado}>
        <p className={estilos.eyebrow}>/transparencia</p>
        <h1>Transparencia</h1>
        <p className={estilos.bajada}>
          Todo lo que entró, todo lo que salió y el comprobante de cada gasto. Se actualiza solo, apenas se
          registra un movimiento.
        </p>
      </div>

      <div className={estilos.totales}>
        <div className={estilos.total}>
          <span className={estilos.etiqueta}>Donaciones verificadas</span>
          <Importe centavos={totales.recibidoCentavos} tamano="grande" />
        </div>
        <div className={estilos.total}>
          <span className={estilos.etiqueta}>Gastos documentados</span>
          <Importe centavos={totales.gastadoCentavos} tamano="grande" />
        </div>
        <div className={estilos.total}>
          <span className={estilos.etiqueta}>Saldo disponible</span>
          <Importe centavos={totales.saldoCentavos} tamano="grande" />
        </div>
        <div className={estilos.total}>
          <span className={estilos.etiqueta}>Casos abiertos / cerrados</span>
          <span className={estilos.numero}>
            {totales.casosAbiertos} / {totales.casosCerrados}
          </span>
        </div>
      </div>

      <Card>
        <CardCuerpo>
          <h2>Casos</h2>
          <p className={estilos.aclaracion}>
            Los casos cerrados siguen publicados: el enlace que circuló en Facebook nunca deja de funcionar.
          </p>
          <div className={estilos.tablaContenedor}>
            <table className={estilos.tabla}>
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Meta</th>
                  <th>Recibido</th>
                  <th>Gastado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {casos.map((caso) => {
                  const pildora = ESTADO_EN_PILDORA[caso.estado];
                  return (
                    <tr key={caso.id}>
                      <td>
                        <Link href={`/ayudar/${caso.slug}`}>{caso.titulo}</Link>
                      </td>
                      <td className={estilos.numero}>
                        <Importe centavos={caso.metaCentavos} />
                      </td>
                      <td className={estilos.numero}>
                        <Importe centavos={caso.recibidoCentavos} />
                      </td>
                      <td className={estilos.numero}>
                        <Importe centavos={caso.gastadoCentavos} />
                      </td>
                      <td>
                        <Pildora tono={pildora.tono}>{pildora.texto}</Pildora>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardCuerpo>
      </Card>

      <Card>
        <CardCuerpo>
          <h2>Cómo se calcula lo que ves</h2>
          <ol className={estilos.metodologia}>
            {METODOLOGIA.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
        </CardCuerpo>
      </Card>
    </main>
  );
}
