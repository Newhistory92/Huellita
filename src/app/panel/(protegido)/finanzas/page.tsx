import Link from "next/link";
import { auth } from "@/infra/auth";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { listarCasosFinanzas } from "@/domains/finanzas/casos";
import { transferenciasPendientes } from "@/domains/finanzas/donaciones";
import { sumarCentavos } from "@/domains/finanzas/dinero";
import type { ContextoFinanzas, EstadoCaso } from "@/domains/finanzas/tipos";
import { Boton } from "@/ui/componentes/Boton";
import { Pildora } from "@/ui/componentes/Pildora";
import { Card } from "@/ui/componentes/Card";
import { Importe } from "@/ui/finanzas/Importe";
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

const TONO_POR_ESTADO: Record<EstadoCaso, "ok" | "warn" | "marca"> = {
  ABIERTO: "ok",
  META_ALCANZADA: "marca",
  CERRADO: "warn",
};

export default async function PanelDeFinanzas() {
  const ctx = await contexto();
  const [casos, pendientes] = await Promise.all([listarCasosFinanzas({}, ctx), transferenciasPendientes(ctx)]);
  const totalPendienteCentavos = sumarCentavos(pendientes.map((i) => i.centavos));

  return (
    <main className={estilos.contenedor}>
      <div className={estilos.encabezado}>
        <h1>Finanzas</h1>
        <Link href="/panel/finanzas/casos/nuevo">
          <Boton variante="primario">Nuevo caso</Boton>
        </Link>
      </div>

      <Link href="/panel/finanzas/transferencias" className={estilos.bandeja}>
        <span>
          {pendientes.length === 0
            ? "No hay transferencias pendientes de verificar"
            : `${pendientes.length} transferencia${pendientes.length === 1 ? "" : "s"} pendiente${pendientes.length === 1 ? "" : "s"} de verificar`}
        </span>
        {totalPendienteCentavos > 0n ? <Importe centavos={totalPendienteCentavos} /> : null}
      </Link>

      <Card>
        {casos.length === 0 ? (
          <p className={estilos.vacio}>Todavía no hay ningún caso financiero.</p>
        ) : (
          <table className={estilos.tabla}>
            <thead>
              <tr>
                <th>Caso</th>
                <th>Estado</th>
                <th>Recaudado</th>
                <th>Gastado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {casos.map((caso) => (
                <tr key={caso.id}>
                  <td>{caso.titulo}</td>
                  <td>
                    <Pildora tono={TONO_POR_ESTADO[caso.estado]}>{caso.estado}</Pildora>
                  </td>
                  <td>
                    <Importe centavos={caso.recibidoCentavos} /> / <Importe centavos={caso.metaCentavos} />
                  </td>
                  <td>
                    <Importe centavos={caso.gastadoCentavos} />
                  </td>
                  <td>
                    <Link href={`/panel/finanzas/casos/${caso.id}`}>Administrar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
