import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function archivosDe(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => path.join(dir, f));
}

describe("invariantes de la entrega 4", () => {
  it("ningún dominio importa el proveedor de correo: solo el puerto", () => {
    const infractores = archivosDe("src/domains").filter((f) =>
      /from "@\/infra\/correo|from "resend"/.test(readFileSync(f, "utf8"))
    );
    expect(infractores, `el dominio no puede conocer al proveedor: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("ningún dominio manda un correo: solo anota avisos", () => {
    // avisos/cola.ts es la excepción legítima: es el propio vaciado de la cola,
    // que manda por el puerto inyectado. Lo que este invariante prohíbe es que
    // un dominio de negocio (finanzas, postulaciones, pagos) mande por atajo.
    const infractores = archivosDe("src/domains")
      .filter((f) => !f.endsWith(path.join("avisos", "cola.ts")))
      .filter((f) => /\.enviar\(\s*\{[^}]*asunto/.test(readFileSync(f, "utf8")));
    expect(
      infractores,
      `mandar un correo desde el dominio lo pone dentro de la transacción: ${infractores.join(", ")}`
    ).toHaveLength(0);
  });

  it("la ruta de vaciado valida el secreto antes de tocar la cola", () => {
    const ruta = readFileSync("src/app/api/tareas/avisos/route.ts", "utf8");
    // Se busca el llamado, no el nombre a secas: el nombre también aparece en
    // el import de arriba, que no dice nada sobre el orden en tiempo de ejecución.
    const posicionSecreto = ruta.indexOf("secretoValido(pedido");
    const posicionVaciado = ruta.indexOf("await vaciarCola(");
    expect(posicionSecreto).toBeGreaterThan(-1);
    expect(posicionVaciado).toBeGreaterThan(-1);
    expect(posicionSecreto, "el secreto se valida después de vaciar").toBeLessThan(posicionVaciado);
  });

  it("el adaptador de Resend revisa el error de la respuesta", () => {
    const adaptador = readFileSync("src/infra/correo/resend.ts", "utf8");
    expect(adaptador).toMatch(/if\s*\(\s*error\s*\)/);
  });

  it("el puerto de avisos es obligatorio en los contextos, no opcional", () => {
    for (const archivo of [
      "src/domains/finanzas/tipos.ts",
      "src/domains/postulaciones/tipos.ts",
      "src/domains/pagos/procesar-aviso.ts",
    ]) {
      const contenido = readFileSync(archivo, "utf8");
      expect(contenido, `${archivo} no declara el puerto de avisos`).toMatch(/avisos:\s*PuertoAvisos/);
      expect(contenido, `${archivo} lo declara opcional: dejaría de avisar en silencio`).not.toMatch(
        /avisos\?:\s*PuertoAvisos/
      );
    }
  });

  it("las novedades no se borran: no hay ninguna llamada a delete", () => {
    const repositorio = readFileSync("src/infra/repositorios/novedades.ts", "utf8");
    expect(repositorio).not.toMatch(/novedad\.delete/);
  });
});
