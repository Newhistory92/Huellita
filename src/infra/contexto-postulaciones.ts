import { auth } from "@/infra/auth";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { repositorioPostulacionesPrisma } from "@/infra/repositorios/postulaciones";
import type { ContextoPostulaciones } from "@/domains/postulaciones/tipos";

/**
 * Arma el contexto de una página o ruta del panel a partir de la sesión.
 *
 * Va en un módulo aparte del repositorio, igual que `contexto-finanzas.ts`,
 * porque ese repositorio lo importan también las consultas públicas y las
 * pruebas de integración, que no necesitan (ni pueden, fuera del runtime de
 * Next.js) cargar next-auth.
 */
export async function contextoPostulaciones(): Promise<ContextoPostulaciones> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");
  return {
    usuarioEmail: sesion.user.email,
    rol: sesion.user.rol as ContextoPostulaciones["rol"],
    repositorio: repositorioPostulacionesPrisma(),
    auditoria: auditoriaPrisma(),
  };
}
