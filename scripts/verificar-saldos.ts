import { verificarSaldos } from "@/domains/finanzas/verificacion";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { auditoriaPrisma } from "@/infra/repositorios/animales";

async function main() {
  const diferencias = await verificarSaldos(repositorioFinanzasPrisma());

  await auditoriaPrisma().registrar({
    usuarioEmail: "sistema",
    accion: "VERIFICAR_SALDOS",
    entidad: "CasoFinanciero",
    entidadId: "todos",
    valorNuevo: { diferencias },
  });

  if (diferencias.length > 0) {
    console.error(`Hay ${diferencias.length} caso(s) con el saldo guardado distinto del calculado:`, diferencias);
    process.exit(1);
  }

  console.log("Los saldos guardados coinciden con la suma de asientos en todos los casos.");
}

main();
