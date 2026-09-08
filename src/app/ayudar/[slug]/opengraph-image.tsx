import { ImageResponse } from "next/og";
import { casoPorSlug, porcentajeDeAvance } from "@/domains/finanzas/consultas";
import { formatearCentavos } from "@/domains/finanzas/dinero";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Caso de ayuda";

/** Sin esta imagen, el enlace compartido en Facebook o WhatsApp se ve pelado y nadie hace clic. */
export default async function ImagenSocial({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caso = await casoPorSlug(slug);

  const titulo = caso ? caso.titulo : "Huellas — Ayudanos a ayudar";
  const avance = caso ? porcentajeDeAvance(caso) : 0;
  const importe = caso ? `${formatearCentavos(caso.recibidoCentavos)} de ${formatearCentavos(caso.metaCentavos)}` : null;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#E9E9E7", padding: 64 }}>
        <p style={{ fontSize: 28, color: "#0E6B57", fontWeight: 700, margin: 0 }}>Huellas</p>
        <p style={{ fontSize: 54, color: "#191714", fontWeight: 700, margin: "24px 0 0", lineHeight: 1.15 }}>{titulo}</p>
        {importe && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 12 }}>
            <p style={{ fontSize: 40, color: "#B85416", fontWeight: 700, margin: 0 }}>{importe}</p>
            <div style={{ display: "flex", width: "100%", height: 14, borderRadius: 999, background: "#DCDAD5" }}>
              <div style={{ display: "flex", width: `${avance}%`, height: "100%", borderRadius: 999, background: "#B85416" }} />
            </div>
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
