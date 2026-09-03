import Link from "next/link";
import { auth } from "@/infra/auth";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { listarAnimales } from "@/domains/animales/servicio";
import type { Contexto, EstadoAnimal } from "@/domains/animales/tipos";
import { Boton } from "@/ui/componentes/Boton";
import { Pildora } from "@/ui/componentes/Pildora";
import { Card } from "@/ui/componentes/Card";
import { FiltroEstado } from "./FiltroEstado";
import estilos from "./page.module.css";

const ESTADOS: EstadoAnimal[] = [
  "BORRADOR",
  "DISPONIBLE",
  "EN_EVALUACION",
  "RESERVADO",
  "ADOPTADO",
  "TRANSITO",
  "TRATAMIENTO",
  "NO_DISPONIBLE",
  "FALLECIDO",
];

const TONO_POR_ESTADO: Record<EstadoAnimal, "ok" | "warn" | "bad" | "neutro" | "marca" | "adoptado"> = {
  BORRADOR: "neutro",
  DISPONIBLE: "ok",
  EN_EVALUACION: "warn",
  RESERVADO: "warn",
  ADOPTADO: "adoptado",
  TRANSITO: "marca",
  TRATAMIENTO: "warn",
  NO_DISPONIBLE: "bad",
  FALLECIDO: "bad",
};

async function contexto(): Promise<Contexto> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");
  return {
    usuarioEmail: sesion.user.email,
    rol: sesion.user.rol as Contexto["rol"],
    repositorio: repositorioPrisma(),
    auditoria: auditoriaPrisma(),
  };
}

export default async function ListadoDeAnimales({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const ctx = await contexto();
  const filtro = estado && ESTADOS.includes(estado as EstadoAnimal) ? { estado: estado as EstadoAnimal } : {};
  const animales = await listarAnimales(filtro, ctx);

  // Los archivados nunca desaparecen del panel: se muestran al final, atenuados.
  const ordenados = [...animales].sort((a, b) => Number(a.archivado) - Number(b.archivado));

  return (
    <main className={estilos.contenedor}>
      <div className={estilos.encabezado}>
        <h1>Animales</h1>
        <Link href="/panel/animales/nuevo">
          <Boton variante="primario">Dar de alta</Boton>
        </Link>
      </div>

      <FiltroEstado />

      <Card>
        {ordenados.length === 0 ? (
          <p className={estilos.vacio}>No hay animales que coincidan con este filtro.</p>
        ) : (
          <table className={estilos.tabla}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Especie</th>
                <th>Estado</th>
                <th>Publicado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordenados.map((animal) => (
                <tr key={animal.id} className={animal.archivado ? estilos.atenuada : ""}>
                  <td>{animal.nombre}</td>
                  <td>{animal.especie}</td>
                  <td>
                    <Pildora tono={animal.archivado ? "neutro" : TONO_POR_ESTADO[animal.estado]}>
                      {animal.archivado ? "ARCHIVADO" : animal.estado}
                    </Pildora>
                  </td>
                  <td>{animal.publicadoEn ? new Date(animal.publicadoEn).toLocaleDateString("es-AR") : "—"}</td>
                  <td>
                    <Link href={`/panel/animales/${animal.id}`}>Editar</Link>
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
