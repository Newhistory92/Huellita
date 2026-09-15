import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/infra/auth";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { listarAnimales } from "@/domains/animales/servicio";
import { contextoPostulaciones } from "@/infra/contexto-postulaciones";
import {
  postulacionesDelPanel,
  contarPorEstado,
  respuestasPorPostulacion,
  filtrarPorRespuesta,
} from "@/domains/postulaciones/consultas";
import { puede } from "@/domains/usuarios/autorizacion";
import type { Contexto as ContextoAnimales } from "@/domains/animales/tipos";
import type { EstadoPostulacion } from "@/domains/postulaciones/tipos";
import { Card } from "@/ui/componentes/Card";
import { Pildora } from "@/ui/componentes/Pildora";
import { Boton } from "@/ui/componentes/Boton";
import estilos from "./page.module.css";

const ESTADOS: EstadoPostulacion[] = [
  "NUEVA",
  "EN_REVISION",
  "CONTACTADA",
  "ENTREVISTA",
  "APROBADA",
  "RECHAZADA",
  "ADOPCION_CONCRETADA",
];

const TONO_POR_ESTADO: Record<EstadoPostulacion, "ok" | "warn" | "bad" | "neutro" | "marca" | "adoptado"> = {
  NUEVA: "warn",
  EN_REVISION: "neutro",
  CONTACTADA: "neutro",
  ENTREVISTA: "marca",
  APROBADA: "ok",
  RECHAZADA: "bad",
  ADOPCION_CONCRETADA: "adoptado",
};

async function contextoAnimales(): Promise<ContextoAnimales> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");
  return {
    usuarioEmail: sesion.user.email,
    rol: sesion.user.rol as ContextoAnimales["rol"],
    repositorio: repositorioPrisma(),
    auditoria: auditoriaPrisma(),
  };
}

export default async function BandejaDePostulaciones({
  searchParams,
}: {
  searchParams: Promise<{ animalId?: string; estado?: string; q?: string }>;
}) {
  const { animalId, estado, q } = await searchParams;
  const ctx = await contextoPostulaciones();
  // El rol de Finanzas no tiene ningún acceso a postulaciones, ni de lectura.
  if (!puede(ctx.rol, "postulaciones.leer")) notFound();

  const filtro = {
    ...(animalId ? { animalId } : {}),
    ...(estado && ESTADOS.includes(estado as EstadoPostulacion) ? { estado: estado as EstadoPostulacion } : {}),
  };

  const [conteo, postulaciones, animales] = await Promise.all([
    contarPorEstado(ctx),
    postulacionesDelPanel(filtro, ctx),
    listarAnimales({}, await contextoAnimales()),
  ]);

  const nombreDeAnimal = new Map(animales.map((a) => [a.id, a.nombre]));
  const totalGeneral = ESTADOS.reduce((total, e) => total + conteo[e], 0);

  let visibles = postulaciones;
  if (q && q.trim().length > 0) {
    const respuestas = await respuestasPorPostulacion(
      postulaciones.map((p) => p.id),
      ctx
    );
    visibles = filtrarPorRespuesta(postulaciones, respuestas, q);
  }

  const hayFiltros = Boolean(animalId || estado || q);

  return (
    <main className={estilos.contenedor}>
      <div className={estilos.encabezado}>
        <h1>Postulaciones</h1>
      </div>

      <div className={estilos.contador}>
        <Link href="/panel/postulaciones" className={estilos.pildoraLink}>
          <Pildora tono={estado ? "neutro" : "marca"}>Todas: {totalGeneral}</Pildora>
        </Link>
        {ESTADOS.map((e) => (
          <Link key={e} href={`/panel/postulaciones?estado=${e}`} className={estilos.pildoraLink}>
            <Pildora tono={TONO_POR_ESTADO[e]}>
              {e}: {conteo[e]}
            </Pildora>
          </Link>
        ))}
      </div>

      <form className={estilos.filtros}>
        <select name="animalId" defaultValue={animalId ?? ""}>
          <option value="">Todos los animales</option>
          {animales.map((animal) => (
            <option key={animal.id} value={animal.id}>
              {animal.nombre}
            </option>
          ))}
        </select>
        <select name="estado" defaultValue={estado ?? ""}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <input type="text" name="q" placeholder="Buscar en las respuestas" defaultValue={q ?? ""} />
        <Boton type="submit" variante="fantasma" tamano="sm">
          Filtrar
        </Boton>
        {hayFiltros ? (
          <Link href="/panel/postulaciones" className={estilos.limpiar}>
            Limpiar filtros
          </Link>
        ) : null}
      </form>

      <Card>
        {visibles.length === 0 ? (
          <p className={estilos.vacio}>No hay postulaciones que coincidan con este filtro.</p>
        ) : (
          <table className={estilos.tabla}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Animal</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((postulacion) => (
                <tr key={postulacion.id}>
                  <td>{postulacion.anonimizadaEn ? "Datos borrados a pedido" : postulacion.nombre}</td>
                  <td>{nombreDeAnimal.get(postulacion.animalId) ?? "—"}</td>
                  <td>
                    <Pildora tono={TONO_POR_ESTADO[postulacion.estado]}>{postulacion.estado}</Pildora>
                  </td>
                  <td>{new Date(postulacion.creadoEn).toLocaleDateString("es-AR")}</td>
                  <td>
                    <Link href={`/panel/postulaciones/${postulacion.id}`}>Ver</Link>
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
