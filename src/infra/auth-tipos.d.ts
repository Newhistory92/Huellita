import type { DefaultSession } from "next-auth";

/** El rol viaja del token de sesión a `session.user`; acá se declara el tipo. */
declare module "next-auth" {
  interface Session {
    user: { rol: string | null } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    rol?: string | null;
  }
}
