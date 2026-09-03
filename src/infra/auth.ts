import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/infra/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/panel/entrar" },
  callbacks: {
    /** No hay registro público: si el correo no está en la tabla, no entra. */
    async signIn({ user }) {
      if (!user.email) return false;
      const autorizado = await prisma.usuario.findUnique({ where: { email: user.email } });
      return Boolean(autorizado?.activo);
    },
    async jwt({ token }) {
      if (token.email) {
        const usuario = await prisma.usuario.findUnique({ where: { email: token.email } });
        token.rol = usuario?.rol ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.rol = token.rol as string | null;
      return session;
    },
  },
});
