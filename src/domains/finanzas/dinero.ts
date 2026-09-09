/**
 * Los importes son enteros en centavos. Nunca decimales de punto flotante:
 * producen errores de redondeo que después aparecen como diferencias de un
 * peso en el balance público, y en una plataforma cuyo argumento es la
 * verificabilidad, un peso de diferencia destruye el argumento entero.
 */

const FORMATO_SIN_CENTAVOS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const FORMATO_CON_CENTAVOS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** El signo lo pone la interfaz, con color y símbolo. Acá siempre en positivo. */
export function formatearCentavos(centavos: bigint): string {
  const absoluto = centavos < 0n ? -centavos : centavos;
  const enPesos = Number(absoluto) / 100;
  const formato = absoluto % 100n === 0n ? FORMATO_SIN_CENTAVOS : FORMATO_CON_CENTAVOS;
  // Intl deja un espacio no separable después del símbolo; se saca para que
  // el importe ocupe menos en pantallas angostas.
  return formato.format(enPesos).replace(/\s/g, "");
}

export function esIngreso(centavos: bigint): boolean {
  return centavos > 0n;
}

export function sumarCentavos(valores: bigint[]): bigint {
  return valores.reduce((total, valor) => total + valor, 0n);
}

export function separarPorSigno(valores: bigint[]): { entradas: bigint; salidas: bigint } {
  let entradas = 0n;
  let salidas = 0n;
  for (const valor of valores) {
    if (valor > 0n) entradas += valor;
    else salidas += -valor;
  }
  return { entradas, salidas };
}

/**
 * Referencia corta de un asiento, para mostrar en el libro público.
 *
 * El identificador interno tiene veinticinco caracteres: sirve para la base,
 * pero en pantalla es ruido, y nadie puede dictarlo por teléfono para
 * preguntar por un movimiento. Se muestran los últimos cinco, que alcanzan
 * para distinguir movimientos dentro de un mismo caso; el identificador
 * completo queda en el atributo title, para quien necesite el dato exacto.
 */
export function referenciaDeAsiento(id: string): string {
  const cola = id.slice(-5).toUpperCase();
  return `MOV-${cola.length > 0 ? cola : "?"}`;
}
