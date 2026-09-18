import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { repositorioNovedadesPrisma } from "@/infra/repositorios/novedades";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearNovedad, archivarNovedad } from "@/domains/novedades/servicio";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const casos: string[] = [];

afterAll(async () => {
  await prisma.novedad.deleteMany({ where: { casoId: { in: casos } } });
  await prisma.casoFinanciero.deleteMany({ where: { id: { in: casos } } });
  await prisma.$disconnect();
});

async function casoDePrueba() {
  const caso = await prisma.casoFinanciero.create({
    data: {
      slug: `novedades-repo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      titulo: "Caso",
      situacion: "x",
      metaCentavos: 100000n,
    },
  });
  casos.push(caso.id);
  return caso;
}

function contexto(tx: PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) {
  return {
    usuarioEmail: "prueba@huellas.org.ar",
    rol: "REDACCION" as const,
    repositorio: repositorioNovedadesPrisma(tx as never),
    auditoria: auditoriaPrisma(tx as never),
  };
}

describe("repositorio Prisma de novedades", () => {
  it("guarda y devuelve la foto armada", async () => {
    const caso = await casoDePrueba();
    const novedad = await prisma.$transaction(async (tx) =>
      crearNovedad(
        {
          casoId: caso.id,
          titulo: "Con foto",
          cuerpo: "x",
          foto: { clave: "novedades/abc", alt: "Una foto", ancho: 1200, alto: 900, placeholder: "data:image/webp;base64,xx" },
        },
        contexto(tx)
      )
    );

    const leida = await repositorioNovedadesPrisma(prisma).porId(novedad.id);
    expect(leida!.foto).toEqual({
      clave: "novedades/abc",
      alt: "Una foto",
      ancho: 1200,
      alto: 900,
      placeholder: "data:image/webp;base64,xx",
    });
  });

  it("una novedad sin foto la devuelve en nulo, no a medias", async () => {
    const caso = await casoDePrueba();
    const novedad = await prisma.$transaction(async (tx) =>
      crearNovedad({ casoId: caso.id, titulo: "Sin foto", cuerpo: "x" }, contexto(tx))
    );
    const leida = await repositorioNovedadesPrisma(prisma).porId(novedad.id);
    expect(leida!.foto).toBeNull();
  });

  it("las archivadas no salen en las del caso, pero sí en todas", async () => {
    const caso = await casoDePrueba();
    const novedad = await prisma.$transaction(async (tx) =>
      crearNovedad({ casoId: caso.id, titulo: "Para archivar", cuerpo: "x" }, contexto(tx))
    );
    await prisma.$transaction(async (tx) => archivarNovedad(novedad.id, contexto(tx)));

    const repo = repositorioNovedadesPrisma(prisma);
    expect(await repo.delCaso(caso.id)).toHaveLength(0);
    expect(await repo.todasDelCaso(caso.id)).toHaveLength(1);
  });

  it("las devuelve de la más nueva a la más vieja", async () => {
    const caso = await casoDePrueba();
    await prisma.$transaction(async (tx) => crearNovedad({ casoId: caso.id, titulo: "Primera", cuerpo: "x" }, contexto(tx)));
    await new Promise((r) => setTimeout(r, 10));
    await prisma.$transaction(async (tx) => crearNovedad({ casoId: caso.id, titulo: "Segunda", cuerpo: "x" }, contexto(tx)));

    const leidas = await repositorioNovedadesPrisma(prisma).delCaso(caso.id);
    expect(leidas.map((n) => n.titulo)).toEqual(["Segunda", "Primera"]);
  });
});
