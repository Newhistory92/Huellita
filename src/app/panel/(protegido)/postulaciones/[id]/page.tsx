import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/infra/auth";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { obtenerAnimal } from "@/domains/animales/servicio";
import { contextoPostulaciones } from "@/infra/contexto-postulaciones";
import {
  detalleDePostulacion,
  historialDePostulacion,
  postulacionesDelPanel,
} from "@/domains/postulaciones/consultas";
import { puede } from "@/domains/usuarios/autorizacion";
import type { Contexto as ContextoAnimales } from "@/domains/animales/tipos";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Pildora } from "@/ui/componentes/Pildora";
import { Ofertas } from "./Ofertas";
import { CambiarEstado } from "./CambiarEstado";
import { BorrarDatosPersonales } from "./BorrarDatosPersonales";
import estilos from "./page.module.css";

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

export default async function DetalleDePostulacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contextoPostulaciones();
  // El rol de Finanzas no tiene ningún acceso a postulaciones, ni de lectura.
  if (!puede(ctx.rol, "postulaciones.leer")) notFound();

  const detalle = await detalleDePostulacion(id, ctx);
  if (!detalle) notFound();
  const { postulacion, respuestas } = detalle;

  const [animal, historial, postulacionesDelAnimal] = await Promise.all([
    obtenerAnimal(postulacion.animalId, await contextoAnimales()),
    historialDePostulacion(id, ctx),
    postulacionesDelPanel({ animalId: postulacion.animalId }, ctx),
  ]);

  const abiertasDelAnimal = postulacionesDelAnimal.filter(
    (p) =>
      p.id !== postulacion.id &&
      p.anonimizadaEn === null &&
      p.estado !== "RECHAZADA" &&
      p.estado !== "ADOPCION_CONCRETADA"
  ).length;

  const editable = postulacion.anonimizadaEn === null;

  return (
    <main className={estilos.contenedor}>
      <div>
        <Link href="/panel/postulaciones" className={estilos.volver}>
          ← Volver a la bandeja
        </Link>
        <h1>{editable ? postulacion.nombre : "Datos borrados a pedido"}</h1>
        <p className={estilos.permanente}>
          Postula por{" "}
          <Link href={`/panel/animales/${animal.id}`}>{animal.nombre}</Link>
          {" · "}
          {new Date(postulacion.creadoEn).toLocaleDateString("es-AR")}
        </p>
      </div>

      <Card>
        <CardCuerpo>
          <h2>Contacto</h2>
          {editable ? (
            <dl className={estilos.contacto}>
              <dt>Correo</dt>
              <dd>{postulacion.email}</dd>
              <dt>Teléfono</dt>
              <dd>{postulacion.telefono}</dd>
            </dl>
          ) : (
            <p className={estilos.permanente}>
              Los datos de contacto se borraron a pedido de la persona
              {postulacion.anonimizadaEn ? ` el ${new Date(postulacion.anonimizadaEn).toLocaleDateString("es-AR")}` : ""}.
              La postulación queda de solo lectura.
            </p>
          )}
        </CardCuerpo>
      </Card>

      <Card>
        <CardCuerpo>
          <h2>Estado</h2>
          <Pildora tono="neutro">{postulacion.estado}</Pildora>
          {editable ? <CambiarEstado id={postulacion.id} estadoActual={postulacion.estado} /> : null}
        </CardCuerpo>
      </Card>

      {editable ? (
        <Ofertas
          estado={postulacion.estado}
          animalId={animal.id}
          nombreAnimal={animal.nombre}
          estadoAnimal={animal.estado}
          postulacionId={postulacion.id}
          abiertasDelAnimal={abiertasDelAnimal}
        />
      ) : null}

      <Card>
        <CardCuerpo>
          <h2>Respuestas</h2>
          <dl className={estilos.respuestas}>
            {respuestas.map((respuesta) => (
              <div key={respuesta.id} className={estilos.respuesta}>
                <dt>{respuesta.textoPregunta}</dt>
                <dd>{respuesta.valor || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardCuerpo>
      </Card>

      <Card>
        <CardCuerpo>
          <h2>Historial</h2>
          {historial.length === 0 ? (
            <p className={estilos.permanente}>Sin movimientos todavía.</p>
          ) : (
            <ul className={estilos.historial}>
              {historial.map((entrada, indice) => {
                const comentario =
                  entrada.valorNuevo && typeof entrada.valorNuevo === "object" && "comentario" in entrada.valorNuevo
                    ? String((entrada.valorNuevo as { comentario: unknown }).comentario)
                    : null;
                return (
                  <li key={indice}>
                    <span className={estilos.permanente}>
                      {new Date(entrada.creadoEn).toLocaleString("es-AR")} · {entrada.usuarioEmail}
                    </span>
                    <p>{entrada.accion}</p>
                    {comentario ? <p>{comentario}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardCuerpo>
      </Card>

      {editable ? (
        <Card>
          <CardCuerpo>
            <BorrarDatosPersonales id={postulacion.id} />
          </CardCuerpo>
        </Card>
      ) : null}
    </main>
  );
}
