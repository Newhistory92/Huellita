import { notFound } from "next/navigation";
import { contextoPostulaciones } from "@/infra/contexto-postulaciones";
import { preguntasDelFormularioPanel } from "@/domains/postulaciones/consultas";
import { puede } from "@/domains/usuarios/autorizacion";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { ListaPreguntas } from "./ListaPreguntas";
import estilos from "./page.module.css";

export default async function PanelDeFormulario() {
  const ctx = await contextoPostulaciones();
  // El rol de Finanzas no tiene ningún acceso a postulaciones, ni de lectura.
  if (!puede(ctx.rol, "postulaciones.leer")) notFound();

  const preguntas = await preguntasDelFormularioPanel(ctx);

  return (
    <main className={estilos.contenedor}>
      <div>
        <h1>Formulario de postulación</h1>
        <p className={estilos.ayuda}>
          Estas preguntas se le hacen a quien postula para adoptar cualquier animal. Las preguntas propias de un
          animal en particular se agregan desde su ficha de edición.
        </p>
      </div>

      <Card>
        <CardCuerpo>
          <ListaPreguntas preguntas={preguntas} />
        </CardCuerpo>
      </Card>
    </main>
  );
}
