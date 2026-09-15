import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoFinanzas } from "@/infra/contexto-finanzas";
import { obtenerCaso, listarCasosFinanzas } from "@/domains/finanzas/casos";
import { libroDeCaso, pendienteDeCaso } from "@/domains/finanzas/consultas";
import { formatearCentavos } from "@/domains/finanzas/dinero";
import { Card, CardCuerpo } from "@/ui/componentes/Card";
import { Campo } from "@/ui/componentes/Campo";
import { CampoCalculado } from "@/ui/componentes/CampoCalculado";
import { Boton } from "@/ui/componentes/Boton";
import { FormularioConToast } from "@/ui/componentes/FormularioConToast";
import { Importe } from "@/ui/finanzas/Importe";
import {
  accionCrearCaso,
  accionEditarCaso,
  accionRegistrarGasto,
  accionRegistrarAjuste,
  accionTrasladar,
} from "../../acciones";
import estilos from "./page.module.css";

export default async function FormularioDeCaso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const esAlta = id === "nuevo";
  const ctx = await contextoFinanzas();

  const caso = esAlta ? null : await obtenerCaso(id, ctx).catch(() => null);
  if (!esAlta && !caso) notFound();

  const [asientos, pendienteCentavos, casosAbiertos] = caso
    ? await Promise.all([libroDeCaso(caso.id), pendienteDeCaso(caso.id), listarCasosFinanzas({ soloAbiertos: true }, ctx)])
    : [[], 0n, []];

  const destinos = casosAbiertos.filter((c) => c.id !== id);
  const accionGuardar = esAlta ? accionCrearCaso : accionEditarCaso.bind(null, id);

  return (
    <main className={estilos.contenedor}>
      <div>
        <Link href="/panel/finanzas" className={estilos.volver}>
          ← Volver al listado
        </Link>
        <h1>{esAlta ? "Nuevo caso financiero" : `Editar ${caso!.titulo}`}</h1>
        {caso ? <p className={estilos.permanente}>Dirección permanente: /ayudar/{caso.slug}</p> : null}
      </div>

      <Card>
        <CardCuerpo>
          <FormularioConToast accion={accionGuardar} className={estilos.formulario}>
            <Campo etiqueta="Título" nombre="titulo">
              <input id="titulo" name="titulo" defaultValue={caso?.titulo} required />
            </Campo>
            <Campo
              etiqueta="Situación"
              nombre="situacion"
              ayuda="Contá qué le pasó al animal: es lo primero que lee quien llega desde Facebook."
            >
              <textarea id="situacion" name="situacion" defaultValue={caso?.situacion} required minLength={20} />
            </Campo>
            <Campo etiqueta="Meta (en pesos)" nombre="metaPesos">
              <input
                id="metaPesos"
                name="metaPesos"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={caso ? Number(caso.metaCentavos) / 100 : undefined}
                required
              />
            </Campo>

            {caso ? (
              <>
                <CampoCalculado
                  etiqueta="Recaudado"
                  valor={<Importe centavos={caso.recibidoCentavos} />}
                  explicacion={`Se calcula sumando ${asientos.filter((a) => a.centavos > 0n).length} movimiento(s) del libro contable. No se edita a mano.`}
                />
                <CampoCalculado
                  etiqueta="Gastado"
                  valor={<Importe centavos={caso.gastadoCentavos} />}
                  explicacion={`Se calcula sumando ${asientos.filter((a) => a.centavos < 0n).length} movimiento(s) del libro contable. No se edita a mano.`}
                />
                {pendienteCentavos > 0n ? (
                  <p className={estilos.pendiente}>
                    Hay <Importe centavos={pendienteCentavos} /> en transferencias declaradas sin verificar. No están
                    sumadas arriba.
                  </p>
                ) : null}
              </>
            ) : null}

            <Boton type="submit" variante="primario">
              {esAlta ? "Crear caso" : "Guardar cambios"}
            </Boton>
          </FormularioConToast>
        </CardCuerpo>
      </Card>

      {caso ? (
        <Card>
          <CardCuerpo>
            <h2>Registrar un gasto</h2>
            <FormularioConToast accion={accionRegistrarGasto} className={estilos.formulario}>
              <input type="hidden" name="casoId" value={caso.id} />
              <Campo etiqueta="Importe (en pesos)" nombre="pesos">
                <input id="pesos" name="pesos" type="number" step="0.01" min="0.01" required />
              </Campo>
              <Campo etiqueta="Descripción" nombre="descripcion">
                <input id="descripcion" name="descripcion" required minLength={3} />
              </Campo>
              <Campo etiqueta="Fecha" nombre="fecha">
                <input id="fecha" name="fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
              </Campo>
              <Campo
                etiqueta="Comprobante"
                nombre="comprobante"
                ayuda="Opcional, pero un gasto sin comprobante se ve incompleto en la ficha pública."
              >
                <input id="comprobante" name="comprobante" type="file" accept="image/*,application/pdf" />
              </Campo>
              <label className={estilos.casilla}>
                <input type="checkbox" name="datosPersonalesTachados" />
                El comprobante no muestra datos personales: se puede publicar
              </label>
              <Boton type="submit" variante="primario">
                Registrar gasto
              </Boton>
            </FormularioConToast>
          </CardCuerpo>
        </Card>
      ) : null}

      {caso && asientos.length > 0 ? (
        <Card>
          <CardCuerpo>
            <h2>Registrar un ajuste</h2>
            <p className={estilos.aclaracion}>
              El ajuste corrige un movimiento sin borrarlo: queda publicado en el libro del caso, junto al motivo.
            </p>
            <FormularioConToast accion={accionRegistrarAjuste} className={estilos.formulario}>
              <input type="hidden" name="casoId" value={caso.id} />
              <Campo etiqueta="Movimiento que corrige" nombre="ajustaAId">
                <select id="ajustaAId" name="ajustaAId" required>
                  {asientos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.descripcion} ({formatearCentavos(a.centavos)})
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Importe del ajuste (en pesos, puede ser negativo)" nombre="pesos">
                <input id="pesos" name="pesos" type="number" step="0.01" required />
              </Campo>
              <Campo etiqueta="Motivo" nombre="motivo" ayuda="Queda publicado en el libro del caso.">
                <textarea id="motivo" name="motivo" required minLength={10} />
              </Campo>
              <Campo etiqueta="Comprobante de respaldo" nombre="comprobante">
                <input id="comprobante" name="comprobante" type="file" accept="image/*,application/pdf" required />
              </Campo>
              <label className={estilos.casilla}>
                <input type="checkbox" name="datosPersonalesTachados" />
                El comprobante no muestra datos personales: se puede publicar
              </label>
              <Boton type="submit" variante="primario">
                Registrar ajuste
              </Boton>
            </FormularioConToast>
          </CardCuerpo>
        </Card>
      ) : null}

      {caso && destinos.length > 0 ? (
        <Card>
          <CardCuerpo>
            <h2>Trasladar excedente a otro caso</h2>
            <FormularioConToast accion={accionTrasladar} className={estilos.formulario}>
              <input type="hidden" name="origenId" value={caso.id} />
              <Campo etiqueta="Caso destino" nombre="destinoId">
                <select id="destinoId" name="destinoId" required>
                  {destinos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.titulo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Importe (en pesos)" nombre="pesos">
                <input id="pesos" name="pesos" type="number" step="0.01" min="0.01" required />
              </Campo>
              <Campo etiqueta="Motivo" nombre="motivo" ayuda="Queda publicado en el libro de los dos casos.">
                <textarea id="motivo" name="motivo" required minLength={10} />
              </Campo>
              <Boton type="submit" variante="primario">
                Trasladar
              </Boton>
            </FormularioConToast>
          </CardCuerpo>
        </Card>
      ) : null}
    </main>
  );
}
