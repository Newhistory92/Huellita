import { redirect } from "next/navigation";
import { auth } from "@/infra/auth";

export const metadata = { robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) redirect("/panel/entrar");
  return <div data-panel>{children}</div>;
}
