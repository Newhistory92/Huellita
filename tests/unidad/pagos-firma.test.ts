import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { firmaValida } from "@/infra/pagos/firma";

const SECRETO = "secreto-de-prueba";
const ID_RECURSO = "1327884391";
const ID_PEDIDO = "req-abc";
const MARCA_TIEMPO = "1757000000";

function firmar(id: string, pedido: string, marca: string, secreto = SECRETO): string {
  const manifiesto = `id:${id};request-id:${pedido};ts:${marca};`;
  return createHmac("sha256", secreto).update(manifiesto).digest("hex");
}

describe("firmaValida", () => {
  it("acepta una firma correcta", () => {
    const v1 = firmar(ID_RECURSO, ID_PEDIDO, MARCA_TIEMPO);
    expect(
      firmaValida({ cabeceraFirma: `ts=${MARCA_TIEMPO},v1=${v1}`, cabeceraPedido: ID_PEDIDO, idDelRecurso: ID_RECURSO, secreto: SECRETO })
    ).toBe(true);
  });

  it("rechaza una firma de otro secreto: es el caso del aviso falsificado", () => {
    const v1 = firmar(ID_RECURSO, ID_PEDIDO, MARCA_TIEMPO, "secreto-del-atacante");
    expect(
      firmaValida({ cabeceraFirma: `ts=${MARCA_TIEMPO},v1=${v1}`, cabeceraPedido: ID_PEDIDO, idDelRecurso: ID_RECURSO, secreto: SECRETO })
    ).toBe(false);
  });

  it("rechaza si cambiaron el número de pago", () => {
    const v1 = firmar(ID_RECURSO, ID_PEDIDO, MARCA_TIEMPO);
    expect(
      firmaValida({ cabeceraFirma: `ts=${MARCA_TIEMPO},v1=${v1}`, cabeceraPedido: ID_PEDIDO, idDelRecurso: "999", secreto: SECRETO })
    ).toBe(false);
  });

  it("rechaza una cabecera con formato inesperado", () => {
    expect(firmaValida({ cabeceraFirma: "cualquier cosa", cabeceraPedido: ID_PEDIDO, idDelRecurso: ID_RECURSO, secreto: SECRETO })).toBe(false);
  });

  it("rechaza si falta la cabecera", () => {
    expect(firmaValida({ cabeceraFirma: null, cabeceraPedido: ID_PEDIDO, idDelRecurso: ID_RECURSO, secreto: SECRETO })).toBe(false);
  });

  it("sin secreto configurado no valida nada: mejor rechazar que aceptar todo", () => {
    const v1 = firmar(ID_RECURSO, ID_PEDIDO, MARCA_TIEMPO);
    expect(
      firmaValida({ cabeceraFirma: `ts=${MARCA_TIEMPO},v1=${v1}`, cabeceraPedido: ID_PEDIDO, idDelRecurso: ID_RECURSO, secreto: "" })
    ).toBe(false);
  });
});
