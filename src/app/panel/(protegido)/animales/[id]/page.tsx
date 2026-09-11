import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/infra/auth";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { repositorioFotosPrisma } from "@/infra/repositorios/fotos";
import { obtenerAnimal } from "@/domains/animales/servicio";
import { listarFotos } from "@/domains/animales/fotos-servicio";
import { preguntasDelAnimalPanel } from "@/domains/postulaciones/consultas";
import type { Contexto, ContextoFotos, Especie, Sexo, Tamano } from "@/domains/animales/tipos";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Campo } from "@/ui/componentes/Campo";
import { Boton } from "@/ui/componentes/Boton";
import { ListaPreguntas } from "@/app/panel/(protegido)/formulario/ListaPreguntas";
import { accionCrearAnimal, accionEditarAnimal, accionPublicarAnimal, accionArchivarAnimal } from "../acciones";
import { Fotos } from "./fotos";
import estilos from "./page.module.css";

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

async function contextoFotos(): Promise<ContextoFotos> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");
  return {
    usuarioEmail: sesion.user.email,
    rol: sesion.user.rol as ContextoFotos["rol"],
    repositorio: repositorioFotosPrisma(),
    auditoria: auditoriaPrisma(),
  };
}

const ESPECIES: Especie[] = ["PERRO", "GATO", "OTRO"];
const SEXOS: Sexo[] = ["MACHO", "HEMBRA"];
const TAMANOS: Tamano[] = ["PEQUENO", "MEDIANO", "GRANDE"];

export default async function FormularioDeAnimal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const esAlta = id === "nuevo";

  const animal = esAlta ? null : await obtenerAnimal(id, await contexto()).catch(() => null);
  if (!esAlta && !animal) notFound();

  const fotos = animal ? await listarFotos(animal.id, await contextoFotos()) : [];
  const preguntasPropias = animal ? await preguntasDelAnimalPanel(animal.id) : [];
  const accionGuardar = esAlta ? accionCrearAnimal : accionEditarAnimal.bind(null, id);

  return (
    <main className={estilos.contenedor}>
      <div>
        <Link href="/panel/animales" className={estilos.volver}>
          ← Volver al listado
        </Link>
        <h1>{esAlta ? "Dar de alta un animal" : `Editar a ${animal!.nombre}`}</h1>
        {animal ? <p className={estilos.permanente}>Dirección permanente: /animales/{animal.slug}</p> : null}
      </div>

      <Card>
        <CardCuerpo>
          <form action={accionGuardar} className={estilos.formulario}>
            <Campo etiqueta="Nombre" nombre="nombre">
              <input id="nombre" name="nombre" defaultValue={animal?.nombre} required />
            </Campo>

            <div className={estilos.fila}>
              <Campo etiqueta="Especie" nombre="especie">
                <select id="especie" name="especie" defaultValue={animal?.especie ?? "PERRO"}>
                  {ESPECIES.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Sexo" nombre="sexo">
                <select id="sexo" name="sexo" defaultValue={animal?.sexo ?? "MACHO"}>
                  {SEXOS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Tamaño" nombre="tamano">
                <select id="tamano" name="tamano" defaultValue={animal?.tamano ?? "MEDIANO"}>
                  {TAMANOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>

            <Campo
              etiqueta="Descripción"
              nombre="descripcion"
              ayuda="Contá su historia: de dónde vino, cómo es, qué necesita."
            >
              <textarea id="descripcion" name="descripcion" defaultValue={animal?.descripcion} required minLength={20} />
            </Campo>

            <Campo etiqueta="Personalidad" nombre="personalidad" ayuda="Opcional.">
              <input id="personalidad" name="personalidad" defaultValue={animal?.personalidad ?? ""} />
            </Campo>

            <Campo etiqueta="Zona" nombre="zona" ayuda="Dónde está o dónde busca hogar. Opcional.">
              <input id="zona" name="zona" defaultValue={animal?.zona ?? ""} />
            </Campo>

            <Campo etiqueta="Requisitos para adoptar" nombre="requisitos" ayuda="Opcional.">
              <textarea id="requisitos" name="requisitos" defaultValue={animal?.requisitos ?? ""} />
            </Campo>

            <label className={estilos.casilla}>
              <input type="checkbox" name="castrado" defaultChecked={animal?.castrado ?? false} />
              Está castrado
            </label>
            <label className={estilos.casilla}>
              <input type="checkbox" name="vacunasAlDia" defaultChecked={animal?.vacunasAlDia ?? false} />
              Tiene las vacunas al día
            </label>

            <Boton type="submit" variante="primario">
              {esAlta ? "Crear en borrador" : "Guardar cambios"}
            </Boton>
          </form>
        </CardCuerpo>
      </Card>

      {animal ? (
        <Card>
          <CardCuerpo>
            <div className={estilos.acciones}>
              {animal.estado !== "DISPONIBLE" ? (
                <form action={accionPublicarAnimal.bind(null, animal.id)}>
                  <Boton type="submit" variante="primario">
                    Publicar
                  </Boton>
                </form>
              ) : null}
              {!animal.archivado ? (
                <form action={accionArchivarAnimal.bind(null, animal.id)}>
                  <Boton type="submit" variante="fantasma">
                    Archivar
                  </Boton>
                </form>
              ) : null}
            </div>
          </CardCuerpo>
        </Card>
      ) : null}

      {animal ? <Fotos animalId={animal.id} fotos={fotos} /> : null}

      {animal ? (
        <Card>
          <CardCuerpo>
            <h2>Preguntas propias de {animal.nombre}</h2>
            <p className={estilos.permanente}>
              Se suman a las del formulario base solo para quien postula por {animal.nombre}.
            </p>
            <ListaPreguntas preguntas={preguntasPropias} animalId={animal.id} />
          </CardCuerpo>
        </Card>
      ) : null}
    </main>
  );
}
