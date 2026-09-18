import { auth } from "@/infra/auth";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { repositorioAvisosPrisma } from "@/infra/repositorios/avisos";
import { puertoAvisos } from "@/domains/avisos/cola";
import type { ContextoFinanzas } from "@/domains/finanzas/tipos";

/**
 * Arma el contexto de una página o ruta del panel a partir de la sesión.
 *
 * Va en un módulo aparte de `repositorios/finanzas.ts` porque ese repositorio
 * lo importan también las consultas públicas y las pruebas de integración,
 * que no necesitan (ni pueden, fuera del runtime de Next.js) cargar next-auth.
 */
export async function contextoFinanzas(): Promise<ContextoFinanzas> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");
  return {
    usuarioEmail: sesion.user.email,
    rol: sesion.user.rol as ContextoFinanzas["rol"],
    repositorio: repositorioFinanzasPrisma(),
    auditoria: auditoriaPrisma(),
    avisos: puertoAvisos(repositorioAvisosPrisma()),
  };
}
