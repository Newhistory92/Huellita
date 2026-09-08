import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function archivosDe(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => path.join(dir, f));
}

// Los filtros usan "/" incluso en Windows, donde path.join devuelve "\": se
// normaliza antes de comparar para que la exclusión funcione en cualquier SO.
function conBarras(f: string): string {
  return f.replace(/\\/g, "/");
}

describe("invariantes de la entrega 2", () => {
  it("ninguna página ni componente importa el repositorio de finanzas directamente", () => {
    const infractores = archivosDe("src/app")
      .filter((f) => !conBarras(f).includes("acciones") && !conBarras(f).includes("api/webhooks") && !conBarras(f).includes("consultas"))
      .filter((f) => /repositorioFinanzasPrisma/.test(readFileSync(f, "utf8")));
    expect(infractores, `saltean la capa de dominio: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("solo el dominio finanzas escribe los saldos del caso", () => {
    const infractores = [...archivosDe("src/app"), ...archivosDe("src/infra")]
      .filter((f) => !conBarras(f).includes("repositorios/finanzas"))
      .filter((f) => /recibidoCentavos:\s|gastadoCentavos:\s/.test(readFileSync(f, "utf8")));
    expect(infractores, `escriben saldos fuera del dominio: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("el esquema no tiene ni un solo Float", () => {
    expect(readFileSync("prisma/schema.prisma", "utf8")).not.toMatch(/Float/);
  });

  it("la ruta del aviso valida la firma antes de tocar la base", () => {
    const ruta = readFileSync("src/app/api/webhooks/mercadopago/route.ts", "utf8");
    const posicionFirma = ruta.indexOf("firmaValida");
    const posicionEscritura = ruta.indexOf("eventoWebhook.create");
    expect(posicionFirma).toBeGreaterThan(-1);
    expect(posicionFirma, "la firma se valida después de escribir en la base").toBeLessThan(posicionEscritura);
  });

  it("el adaptador nunca toma un estado desconocido por aprobado", () => {
    const adaptador = readFileSync("src/infra/pagos/mercadopago.ts", "utf8");
    expect(adaptador).toMatch(/return "pendiente"/);
  });
});
