import { vaciarCola } from "@/domains/avisos/cola";
import { repositorioAvisosPrisma } from "@/infra/repositorios/avisos";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { correo } from "@/infra/correo";

async function main() {
  const urlBase = process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000";
  const resumen = await vaciarCola(
    { repositorio: repositorioAvisosPrisma(), correo: correo(), auditoria: auditoriaPrisma() },
    urlBase
  );

  console.log(`Enviados: ${resumen.enviados}. Fallidos: ${resumen.fallidos}. Correos: ${resumen.correos}.`);
}

main();
