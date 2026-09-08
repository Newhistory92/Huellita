import type { Asiento, Caso, Documento, FiltroCasos, Intencion, RepositorioFinanzas, SaldoDelCaso } from "@/domains/finanzas/tipos";

export function repositorioFinanzasEnMemoria(casosIniciales: Caso[] = []) {
  const casos = [...casosIniciales];
  const asientos: Asiento[] = [];
  const intenciones: Intencion[] = [];
  const documentos: Documento[] = [];
  let secuencia = 0;
  const id = (p: string) => `${p}-${++secuencia}`;

  const repo: RepositorioFinanzas = {
    async crearCaso(datos) {
      const caso = { ...datos, id: id("caso"), creadoEn: new Date() } as Caso;
      casos.push(caso);
      return caso;
    },
    async actualizarCaso(idCaso, cambios) {
      const i = casos.findIndex((c) => c.id === idCaso);
      if (i === -1) throw new Error("No existe el caso");
      casos[i] = { ...casos[i], ...cambios };
      return casos[i];
    },
    async casoPorId(idCaso) {
      return casos.find((c) => c.id === idCaso) ?? null;
    },
    async casoPorSlug(slug) {
      return casos.find((c) => c.slug === slug) ?? null;
    },
    async slugsDeCasos() {
      return casos.map((c) => c.slug);
    },
    async listarCasos(filtro: FiltroCasos) {
      return casos.filter(
        (c) => (!filtro.estado || c.estado === filtro.estado) && (!filtro.soloAbiertos || c.estado !== "CERRADO")
      );
    },
    async crearAsiento(datos) {
      if (datos.proveedor && datos.pagoExternoId) {
        const repetido = asientos.some((a) => a.proveedor === datos.proveedor && a.pagoExternoId === datos.pagoExternoId);
        // Espeja la restricción única de la base: sin esto, las pruebas en
        // memoria no detectarían un pago contado dos veces.
        if (repetido) throw new Error("Ya existe un asiento para ese pago");
      }
      const asiento = { ...datos, id: id("asiento"), creadoEn: new Date() } as Asiento;
      asientos.push(asiento);
      return asiento;
    },
    async asientosDeCaso(casoId) {
      return asientos.filter((a) => a.casoId === casoId);
    },
    async saldoDeCaso(casoId) {
      const propios = asientos.filter((a) => a.casoId === casoId);
      let recibidoCentavos = 0n;
      let gastadoCentavos = 0n;
      for (const a of propios) {
        if (a.centavos > 0n) recibidoCentavos += a.centavos;
        else gastadoCentavos += -a.centavos;
      }
      const cantidadDonaciones = propios.filter((a) => a.tipo === "DONACION").length;
      return { recibidoCentavos, gastadoCentavos, cantidadDonaciones } satisfies SaldoDelCaso;
    },
    async asientoPorPagoExterno(proveedor, pagoExternoId) {
      return asientos.find((a) => a.proveedor === proveedor && a.pagoExternoId === pagoExternoId) ?? null;
    },
    async crearIntencion(datos) {
      const intencion = { ...datos, id: id("intencion"), creadoEn: new Date(), resueltoEn: null } as Intencion;
      intenciones.push(intencion);
      return intencion;
    },
    async intencionPorId(idIntencion) {
      return intenciones.find((i) => i.id === idIntencion) ?? null;
    },
    async actualizarIntencion(idIntencion, cambios) {
      const i = intenciones.findIndex((x) => x.id === idIntencion);
      if (i === -1) throw new Error("No existe la intención");
      intenciones[i] = { ...intenciones[i], ...cambios };
      return intenciones[i];
    },
    async intencionesPendientes() {
      return intenciones.filter((i) => i.estado === "PENDIENTE_VERIFICACION");
    },
    async crearDocumento(datos) {
      const documento = { ...datos, id: id("documento"), creadoEn: new Date() } as Documento;
      documentos.push(documento);
      return documento;
    },
    async documentoPorId(idDocumento) {
      return documentos.find((d) => d.id === idDocumento) ?? null;
    },
  };

  return Object.assign(repo, { casos, asientos, intenciones, documentos });
}
