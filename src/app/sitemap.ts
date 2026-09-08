import type { MetadataRoute } from "next";
import { animalesPublicados } from "@/domains/animales/consultas";
import { casosPublicos } from "@/domains/finanzas/consultas";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000";
  const animales = await animalesPublicados({ soloPublicados: true });
  const casos = await casosPublicos({});

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/adopcion`, changeFrequency: "daily", priority: 0.9 },
    ...animales.map((animal) => ({
      url: `${base}/adopcion/${animal.slug}`,
      lastModified: animal.publicadoEn ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: `${base}/ayudar`, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${base}/transparencia`, changeFrequency: "daily" as const, priority: 0.7 },
    ...casos.map((caso) => ({
      url: `${base}/ayudar/${caso.slug}`,
      lastModified: caso.creadoEn,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
