"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { puede, type Accion, type Rol } from "@/domains/usuarios/autorizacion";
import estilos from "./NavPanel.module.css";

const SECCIONES: { etiqueta: string; href: string; accion: Accion }[] = [
  { etiqueta: "Animales", href: "/panel/animales", accion: "animales.leer" },
  { etiqueta: "Postulaciones", href: "/panel/postulaciones", accion: "postulaciones.leer" },
  { etiqueta: "Formulario", href: "/panel/formulario", accion: "postulaciones.leer" },
  { etiqueta: "Finanzas", href: "/panel/finanzas", accion: "finanzas.leer" },
  { etiqueta: "Novedades", href: "/panel/novedades", accion: "novedades.escribir" },
];

/**
 * Solo decide qué pestaña mostrar: el permiso real se vuelve a verificar en el
 * dominio de cada página, así que ocultar una pestaña acá es una comodidad de
 * navegación, nunca la barrera de seguridad.
 */
export function NavPanel({ rol }: { rol: Rol }) {
  const pathname = usePathname();
  const visibles = SECCIONES.filter((seccion) => puede(rol, seccion.accion));

  return (
    <nav className={estilos.nav} aria-label="Secciones del panel">
      {visibles.map((seccion) => {
        const activa = pathname === seccion.href || pathname.startsWith(`${seccion.href}/`);
        return (
          <Link
            key={seccion.href}
            href={seccion.href}
            className={activa ? `${estilos.pestana} ${estilos.activa}` : estilos.pestana}
            aria-current={activa ? "page" : undefined}
          >
            {seccion.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
