import type { MetadataRoute } from "next";
import { animalesPublicados } from "@/domains/animales/consultas";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000";
  const animales = await animalesPublicados({ soloPublicados: true });

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/adopcion`, changeFrequency: "daily", priority: 0.9 },
    ...animales.map((animal) => ({
      url: `${base}/adopcion/${animal.slug}`,
      lastModified: animal.publicadoEn ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
