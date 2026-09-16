import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/infra/auth";
import type { Rol } from "@/domains/usuarios/autorizacion";
import { NavPanel } from "@/ui/panel/NavPanel";
import { ROL_EN_TEXTO } from "@/ui/panel/rol-texto";
import { Boton } from "@/ui/componentes/Boton";
import estilos from "./layout.module.css";

export const metadata = { robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) redirect("/panel/entrar");
  const rol = sesion.user.rol as Rol;

  return (
    <div data-panel>
      <header className={estilos.encabezado}>
        <div className={estilos.franja}>
          <Link href="/panel/animales" className={estilos.marca}>
            Huellas
          </Link>
          <NavPanel rol={rol} />
          <div className={estilos.usuario}>
            <span className={estilos.identidad}>
              {sesion.user.email} · {ROL_EN_TEXTO[rol]}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/panel/entrar" });
              }}
            >
              <Boton type="submit" variante="fantasma" tamano="sm">
                Cerrar sesión
              </Boton>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
