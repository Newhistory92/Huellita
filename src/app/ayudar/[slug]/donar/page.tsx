import Link from "next/link";
import { notFound } from "next/navigation";
import { casoPorSlug } from "@/domains/finanzas/consultas";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Campo } from "@/ui/componentes/Campo";
import { Boton } from "@/ui/componentes/Boton";
import { FormularioConToast } from "@/ui/componentes/FormularioConToast";
import { accionIniciarDonacion } from "./acciones";
import estilos from "./page.module.css";

const MONTOS_SUGERIDOS = [2000, 5000, 10000, 20000];

export default async function DonarParaElCaso({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caso = await casoPorSlug(slug);
  if (!caso) notFound();

  return (
    <main className={estilos.contenedor}>
      <Link href={`/ayudar/${caso.slug}`} className={estilos.volver}>
        ← Volver a {caso.titulo}
      </Link>
      <h1>Donar para {caso.titulo}</h1>

      <Card>
        <CardCuerpo>
          <FormularioConToast accion={accionIniciarDonacion} className={estilos.formulario} mensajeExito={null}>
            <input type="hidden" name="slug" value={caso.slug} />

            <Campo etiqueta="Importe (en pesos)" nombre="pesos" ayuda="El importe mínimo es de $100.">
              <input id="pesos" name="pesos" type="number" step="0.01" min="100" list="montos-sugeridos" required />
              <datalist id="montos-sugeridos">
                {MONTOS_SUGERIDOS.map((monto) => (
                  <option key={monto} value={monto} />
                ))}
              </datalist>
            </Campo>

            <Campo etiqueta="Nombre (opcional)" nombre="nombre">
              <input id="nombre" name="nombre" />
            </Campo>

            <label className={estilos.casilla}>
              <input type="checkbox" name="publicarNombre" />
              Quiero que mi nombre aparezca en el caso
            </label>

            <Campo etiqueta="Mensaje (opcional)" nombre="mensaje">
              <textarea id="mensaje" name="mensaje" />
            </Campo>

            <Boton type="submit" variante="donar">
              Donar con Mercado Pago
            </Boton>
          </FormularioConToast>
        </CardCuerpo>
      </Card>
    </main>
  );
}
