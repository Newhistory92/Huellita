import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { crearAnimal, editarAnimal } from "@/domains/animales/servicio";
import { repositorioEnMemoria, auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

function archivosDe(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => path.join(dir, f));
}

describe("invariantes de la plataforma", () => {
  it("ninguna página ni componente importa Prisma directamente", () => {
    const infractores = archivosDe("src/app")
      .filter((f) => !f.includes("acciones") && !f.replace(/\\/g, "/").includes("api/webhooks"))
      .filter((f) => /from ["']@prisma\/client["']|@\/infra\/prisma/.test(readFileSync(f, "utf8")));
    expect(infractores, `Estos archivos saltean la capa de dominio: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("la dirección de un animal no cambia nunca", async () => {
    const ctx = {
      usuarioEmail: "a@b.c", rol: "ANIMALES" as const,
      repositorio: repositorioEnMemoria(), auditoria: auditoriaEnMemoria(),
    };
    const animal = await crearAnimal(
      { nombre: "Luna", especie: "PERRO", sexo: "HEMBRA", tamano: "GRANDE", descripcion: "Descripción suficientemente larga para publicar." },
      ctx
    );
    const editado = await editarAnimal(animal.id, { slug: "otra-cosa" } as never, ctx);
    expect(editado.slug).toBe("luna");
  });

  it("ningún rol tiene una acción para escribir el total recaudado", () => {
    const autorizacion = readFileSync("src/domains/usuarios/autorizacion.ts", "utf8");
    expect(autorizacion).not.toMatch(/recaudado|saldo/i);
  });

  it("el esquema declara los importes como BigInt, nunca como Float", () => {
    const esquema = readFileSync("prisma/schema.prisma", "utf8");
    expect(esquema).not.toMatch(/Float/);
    expect(esquema).toMatch(/metaCentavos\s+BigInt/);
  });

  it("la migración del disparador de inmutabilidad existe", () => {
    const migraciones = readdirSync("prisma/migrations");
    const inmutable = migraciones.find((m) => m.includes("asientos_inmutables"));
    expect(inmutable).toBeDefined();
    const sql = readFileSync(path.join("prisma/migrations", inmutable!, "migration.sql"), "utf8");
    expect(sql).toMatch(/BEFORE UPDATE ON "AsientoContable"/);
    expect(sql).toMatch(/BEFORE DELETE ON "AsientoContable"/);
  });
});
