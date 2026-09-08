import Link from "next/link";
import { auth } from "@/infra/auth";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { listarCasosFinanzas } from "@/domains/finanzas/casos";
import { transferenciasPendientes } from "@/domains/finanzas/donaciones";
import { sumarCentavos } from "@/domains/finanzas/dinero";
import type { ContextoFinanzas } from "@/domains/finanzas/tipos";
import { Card } from "@/ui/componentes/Card";
import { Boton } from "@/ui/componentes/Boton";
import { Importe } from "@/ui/finanzas/Importe";
import { accionVerificarTransferencia, accionRechazarTransferencia } from "../acciones";
import estilos from "./page.module.css";

async function contexto(): Promise<ContextoFinanzas> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");
  return {
    usuarioEmail: sesion.user.email,
    rol: sesion.user.rol as ContextoFinanzas["rol"],
    repositorio: repositorioFinanzasPrisma(),
    auditoria: auditoriaPrisma(),
  };
}

async function accionRechazar(intencionId: string, formulario: FormData) {
  "use server";
  await accionRechazarTransferencia(intencionId, String(formulario.get("motivo") ?? ""));
}

export default async function BandejaDeTransferencias() {
  const ctx = await contexto();
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
                  <form action={accionVerificarTransferencia.bind(null, intencion.id)}>
                    <Boton type="submit" variante="primario" tamano="sm">
                      Verificar
                    </Boton>
                  </form>
                  <form action={accionRechazar.bind(null, intencion.id)} className={estilos.rechazo}>
                    <input name="motivo" placeholder="Motivo del rechazo" required />
                    <Boton type="submit" variante="fantasma" tamano="sm">
                      Rechazar
                    </Boton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
