import type { Metadata } from "next";
import { Fraunces, Manrope, IBM_Plex_Mono } from "next/font/google";
import "@/ui/tokens.css";
import "@/ui/globales.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--fuente-display",
  display: "swap",
});
const manrope = Manrope({ subsets: ["latin"], variable: "--fuente-cuerpo", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000"),
  title: { default: "Huellas", template: "%s — Huellas" },
  description: "Asociación Civil Huellas. Adopción responsable y transparencia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${fraunces.variable} ${manrope.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
