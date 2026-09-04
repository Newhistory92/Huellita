import sharp from "sharp";
import { ImageResponse } from "next/og";
import { animalPorSlug, fotosDeAnimal } from "@/domains/animales/consultas";
import { almacen } from "@/infra/almacen";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Ficha de adopción";

const ESPECIE_EN_TEXTO = { PERRO: "Perro", GATO: "Gato", OTRO: "Animal" } as const;

/** Sin esta imagen, el enlace compartido en Facebook o WhatsApp se ve pelado y nadie hace clic. */
export default async function ImagenSocial({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const animal = await animalPorSlug(slug);

  let fotoDataUri: string | null = null;
  if (animal) {
    const fotos = await fotosDeAnimal(animal.id);
    const principal = fotos.find((foto) => foto.principal) ?? fotos[0] ?? null;
    // Una foto marcada como sensible nunca aparece en la vista previa social: ahí no hay compuerta que abrir.
    if (principal && !principal.sensible) {
      // El pipeline no agranda: una foto de 480px guarda su medida de 640 como
      // -480. Pedir la medida fija dejaría sin imagen la vista previa de
      // Facebook, que es de donde llega la mayoría de las visitas.
      const anchoDisponible = Math.min(640, principal.ancho);
      const webp = await almacen().leer(`${principal.claveArchivo}-${anchoDisponible}.webp`);
      // satori (el motor de ImageResponse) no entiende WebP: hay que pasarlo a JPEG antes de incrustarlo.
      if (webp) {
        const jpeg = await sharp(webp).resize(420, 630, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
        fotoDataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
      }
    }
  }

  const titulo = animal
    ? animal.estado === "ADOPTADO"
      ? `${animal.nombre} — Adoptado`
      : `${animal.nombre} — ${ESPECIE_EN_TEXTO[animal.especie]} en adopción`
    : "Huellas — Adopción responsable";

  const panelFoto = fotoDataUri ? (
    // eslint-disable-next-line @next/next/no-img-element -- corre dentro de satori, no en el navegador
    <img src={fotoDataUri} alt="" width={420} height={630} />
  ) : (
    <div style={{ display: "flex", width: 420, height: 630 }} />
  );

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#E9E9E7" }}>
        <div style={{ display: "flex", width: 420, height: "100%", background: "#F2F2F0" }}>{panelFoto}</div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 56px", flex: 1 }}>
          <p style={{ fontSize: 28, color: "#0E6B57", fontWeight: 700, margin: 0 }}>Huellas</p>
          <p style={{ fontSize: 54, color: "#191714", fontWeight: 700, margin: "16px 0 0", lineHeight: 1.15 }}>{titulo}</p>
        </div>
      </div>
    ),
    { ...size }
  );
}
