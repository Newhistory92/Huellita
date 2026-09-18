import { auth } from "@/infra/auth";
import { contextoNovedades } from "@/infra/contexto-novedades";
import { contextoFinanzas } from "@/infra/contexto-finanzas";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { listarCasosFinanzas } from "@/domains/finanzas/casos";
import { listarAnimales } from "@/domains/animales/servicio";
import type { Contexto } from "@/domains/animales/tipos";
import type { Novedad } from "@/domains/novedades/tipos";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Boton } from "@/ui/componentes/Boton";
import { Pildora } from "@/ui/componentes/Pildora";
import { Campo } from "@/ui/componentes/Campo";
import { FormularioConToast } from "@/ui/componentes/FormularioConToast";
import { Formulario } from "./Formulario";
import { accionEditarNovedad, accionArchivarNovedad } from "./acciones";
import estilos from "./page.module.css";

async function contextoAnimales(): Promise<Contexto> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");
  return {
    usuarioEmail: sesion.user.email,
    rol: sesion.user.rol as Contexto["rol"],
    repositorio: repositorioPrisma(),
    auditoria: auditoriaPrisma(),
  };
}

type Grupo = { id: string; titulo: string; novedades: Novedad[] };

// Las archivadas quedan al final del grupo, atenuadas: siguen ahí para
// corregir o reactivar el criterio, pero no compiten con lo vigente.
function conArchivadasAlFinal(novedades: Novedad[]): Novedad[] {
  return [...novedades].sort((a, b) => Number(a.archivada) - Number(b.archivada));
}

export default async function PanelDeNovedades() {
  const [ctx, ctxFinanzas, ctxAnimales] = await Promise.all([contextoNovedades(), contextoFinanzas(), contextoAnimales()]);
  const [casos, animales] = await Promise.all([
    listarCasosFinanzas({}, ctxFinanzas),
    listarAnimales({}, ctxAnimales),
  ]);

  const gruposDeCasos: Grupo[] = (
    await Promise.all(
      casos.map(async (caso) => ({
        id: caso.id,
        titulo: caso.titulo,
        novedades: await ctx.repositorio.todasDelCaso(caso.id),
      }))
    )
  ).filter((grupo) => grupo.novedades.length > 0);

  const gruposDeAnimales: Grupo[] = (
    await Promise.all(
      animales.map(async (animal) => ({
        id: animal.id,
        titulo: animal.nombre,
        novedades: await ctx.repositorio.todasDelAnimal(animal.id),
      }))
    )
  ).filter((grupo) => grupo.novedades.length > 0);

  const grupos = [...gruposDeCasos, ...gruposDeAnimales];

  return (
    <main className={estilos.contenedor}>
      <h1>Novedades</h1>

      <Formulario
        casos={casos.map((caso) => ({ id: caso.id, titulo: caso.titulo }))}
        animales={animales.map((animal) => ({ id: animal.id, nombre: animal.nombre }))}
      />

      {grupos.length === 0 ? (
        <Card>
          <CardCuerpo>
            <p className={estilos.vacio}>Todavía no se publicó ninguna novedad.</p>
          </CardCuerpo>
        </Card>
      ) : (
        grupos.map((grupo) => (
          <Card key={grupo.id}>
            <CardCuerpo>
              <h2>{grupo.titulo}</h2>
              <ul className={estilos.lista}>
                {conArchivadasAlFinal(grupo.novedades).map((novedad) => (
                  <li key={novedad.id} className={novedad.archivada ? estilos.atenuada : ""}>
                    <div className={estilos.encabezado}>
                      <div>
                        <strong>{novedad.titulo}</strong>
                        <span className={estilos.meta}>
                          {new Date(novedad.creadoEn).toLocaleDateString("es-AR")} · {novedad.autorEmail}
                        </span>
                      </div>
                      {novedad.archivada ? <Pildora tono="neutro">Archivada</Pildora> : null}
                    </div>

                    <FormularioConToast
                      accion={accionEditarNovedad.bind(null, novedad.id)}
                      className={estilos.edicion}
                      mensajeExito="Novedad editada."
                    >
                      <Campo etiqueta="Título" nombre={`titulo-${novedad.id}`}>
                        <input id={`titulo-${novedad.id}`} name="titulo" defaultValue={novedad.titulo} maxLength={120} required />
                      </Campo>
                      <Campo etiqueta="Cuerpo" nombre={`cuerpo-${novedad.id}`}>
                        <textarea id={`cuerpo-${novedad.id}`} name="cuerpo" defaultValue={novedad.cuerpo} maxLength={4000} rows={3} />
                      </Campo>
                      <Boton type="submit" variante="fantasma" tamano="sm">
                        Guardar cambios
                      </Boton>
                    </FormularioConToast>

                    {!novedad.archivada ? (
                      <FormularioConToast
                        accion={accionArchivarNovedad.bind(null, novedad.id)}
                        mensajeExito="Novedad archivada."
                      >
                        <Boton type="submit" variante="fantasma" tamano="sm">
                          Archivar
                        </Boton>
                      </FormularioConToast>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardCuerpo>
          </Card>
        ))
      )}
    </main>
  );
}
