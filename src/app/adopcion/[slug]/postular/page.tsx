import { notFound } from "next/navigation";
import { animalPorSlug } from "@/domains/animales/consultas";
import { preguntasDelFormularioDe } from "@/domains/postulaciones/consultas";
import { Boton } from "@/ui/componentes/Boton";
import { Campo } from "@/ui/componentes/Campo";
import { FormularioConToast } from "@/ui/componentes/FormularioConToast";
import { CampoDePregunta } from "@/ui/postulaciones/CampoDePregunta";
import { accionEnviarPostulacion } from "./acciones";

export const metadata = { robots: { index: false, follow: true } };

export default async function Postular({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const animal = await animalPorSlug(slug);
  if (!animal) notFound();

  const preguntas = await preguntasDelFormularioDe(animal.id);

  return (
    <main>
      <h1>Postulación para {animal.nombre}</h1>
      <p>Cinco minutos. No hace falta crear una cuenta.</p>

      <p>
        Tus datos personales son privados: los ven únicamente las personas del refugio con permiso de
        adopciones. Nunca aparecen en la parte pública del sitio.
      </p>

      <FormularioConToast accion={accionEnviarPostulacion} mensajeExito={null}>
        <input type="hidden" name="slug" value={slug} />

        <Campo etiqueta="Nombre y apellido *" nombre="nombre">
          <input id="nombre" name="nombre" autoComplete="name" required />
        </Campo>
        <Campo etiqueta="Correo electrónico *" nombre="email">
          <input id="email" name="email" type="email" autoComplete="email" required />
        </Campo>
        <Campo etiqueta="Teléfono o WhatsApp *" nombre="telefono" ayuda="Con código de área.">
          <input id="telefono" name="telefono" type="tel" autoComplete="tel" required />
        </Campo>

        {preguntas.map((pregunta) => (
          <CampoDePregunta key={pregunta.id} pregunta={pregunta} />
        ))}

        <Boton type="submit" variante="primario">
          Enviar postulación
        </Boton>
      </FormularioConToast>
    </main>
  );
}
