import { signIn } from "@/infra/auth";
import { Boton } from "@/ui/componentes/Boton";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import estilos from "./page.module.css";

export const metadata = { robots: { index: false, follow: false } };

/** Sin registro público: entra quien ya figura en la lista de autorizados (tarea 8). */
export default function EntrarAlPanel() {
  return (
    <main className={estilos.contenedor}>
      <Card>
        <CardCuerpo>
          <div className={estilos.texto}>
            <h1>Panel de Huellas</h1>
            <p className={estilos.ayuda}>Acceso restringido al equipo de la asociación.</p>
          </div>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/panel" });
            }}
          >
            <Boton type="submit" variante="primario">
              Entrar con Google
            </Boton>
          </form>
        </CardCuerpo>
      </Card>
    </main>
  );
}
