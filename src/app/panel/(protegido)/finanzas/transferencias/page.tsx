import Link from "next/link";
import { contextoFinanzas } from "@/infra/contexto-finanzas";
import { listarCasosFinanzas } from "@/domains/finanzas/casos";
import { transferenciasPendientes } from "@/domains/finanzas/donaciones";
import { sumarCentavos } from "@/domains/finanzas/dinero";
import { Card } from "@/ui/componentes/Card";
import { Boton } from "@/ui/componentes/Boton";
import { FormularioConToast } from "@/ui/componentes/FormularioConToast";
import { Importe } from "@/ui/finanzas/Importe";
import { accionVerificarTransferencia, accionRechazarTransferencia } from "../acciones";
import estilos from "./page.module.css";

async function accionRechazar(intencionId: string, formulario: FormData) {
  "use server";
  await accionRechazarTransferencia(intencionId, String(formulario.get("motivo") ?? ""));
}

export default async function BandejaDeTransferencias() {
  const ctx = await contextoFinanzas();
  const [pendientes, casos] = await Promise.all([transferenciasPendientes(ctx), listarCasosFinanzas({}, ctx)]);
  const tituloDelCaso = new Map(casos.map((c) => [c.id, c.titulo]));
  const totalCentavos = sumarCentavos(pendientes.map((i) => i.centavos));

  return (
    <main className={estilos.contenedor}>
      <div>
        <Link href="/panel/finanzas" className={estilos.volver}>
          ← Volver a finanzas
        </Link>
        <h1>Transferencias pendientes de verificar</h1>
      </div>

      <p className={estilos.leyenda}>
        <Importe centavos={totalCentavos} /> declarados, no computados al total público hasta que alguien los
        compare contra el extracto bancario.
      </p>

      <Card>
        {pendientes.length === 0 ? (
          <p className={estilos.vacio}>No hay transferencias pendientes de verificar.</p>
        ) : (
          <ul className={estilos.lista}>
            {pendientes.map((intencion) => (
              <li key={intencion.id} className={estilos.fila}>
                <div>
                  <strong>{tituloDelCaso.get(intencion.casoId) ?? intencion.casoId}</strong>
                  <span className={estilos.meta}>
                    {intencion.nombreDonante ?? "Donante anónimo"} · declarada el{" "}
                    {new Date(intencion.creadoEn).toLocaleDateString("es-AR")}
                  </span>
                </div>
                <Importe centavos={intencion.centavos} />
                {intencion.comprobanteId ? (
                  <a href={`/documentos/${intencion.comprobanteId}`} target="_blank" rel="noreferrer">
                    Ver comprobante
                  </a>
                ) : (
                  <span className={estilos.sinComprobante}>Sin comprobante</span>
                )}
                <div className={estilos.acciones}>
                  <FormularioConToast
                    accion={accionVerificarTransferencia.bind(null, intencion.id)}
                    mensajeExito="Transferencia verificada."
                  >
                    <Boton type="submit" variante="primario" tamano="sm">
                      Verificar
                    </Boton>
                  </FormularioConToast>
                  <FormularioConToast
                    accion={accionRechazar.bind(null, intencion.id)}
                    className={estilos.rechazo}
                    mensajeExito="Transferencia rechazada."
                  >
                    <input name="motivo" placeholder="Motivo del rechazo" required />
                    <Boton type="submit" variante="fantasma" tamano="sm">
                      Rechazar
                    </Boton>
                  </FormularioConToast>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
