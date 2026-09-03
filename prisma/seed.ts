import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const email = process.env.EMAIL_ADMINISTRACION;
  if (!email) throw new Error("Definí EMAIL_ADMINISTRACION antes de sembrar");
  await prisma.usuario.upsert({
    where: { email },
    update: { rol: "ADMINISTRACION", activo: true },
    create: { email, nombre: "Administración", rol: "ADMINISTRACION" },
  });
  console.log(`Usuario de administración listo: ${email}`);
}

main().finally(() => prisma.$disconnect());
