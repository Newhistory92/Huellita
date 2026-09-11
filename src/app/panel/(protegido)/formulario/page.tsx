import { preguntasDelFormularioPanel } from "@/domains/postulaciones/consultas";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { ListaPreguntas } from "./ListaPreguntas";
import estilos from "./page.module.css";

export default async function PanelDeFormulario() {
  const preguntas = await preguntasDelFormularioPanel();

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
