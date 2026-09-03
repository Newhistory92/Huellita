import type { Animal, FiltroAnimales, RepositorioAnimales, PuertoAuditoria, EntradaAuditoria } from "@/domains/animales/tipos";

export function repositorioEnMemoria(iniciales: Animal[] = []): RepositorioAnimales & { datos: Animal[] } {
  const datos = [...iniciales];
  let secuencia = datos.length;
  return {
    datos,
    async crear(entrada) {
      const animal = { ...entrada, id: `id-${++secuencia}` } as Animal;
      datos.push(animal);
      return animal;
    },
    async actualizar(id, cambios) {
      const i = datos.findIndex((a) => a.id === id);
      if (i === -1) throw new Error("No existe el animal");
      datos[i] = { ...datos[i], ...cambios };
      return datos[i];
    },
    async porId(id) {
      return datos.find((a) => a.id === id) ?? null;
    },
    async porSlug(slug) {
      return datos.find((a) => a.slug === slug) ?? null;
    },
    async slugsExistentes() {
      return datos.map((a) => a.slug);
    },
    async listar(filtro: FiltroAnimales) {
      return datos.filter(
        (a) =>
          (!filtro.especie || a.especie === filtro.especie) &&
          (!filtro.tamano || a.tamano === filtro.tamano) &&
          (!filtro.estado || a.estado === filtro.estado) &&
          (!filtro.soloPublicados || (a.publicadoEn !== null && !a.archivado))
      );
    },
  };
}

export function auditoriaEnMemoria(): PuertoAuditoria & { entradas: EntradaAuditoria[] } {
  const entradas: EntradaAuditoria[] = [];
  return { entradas, async registrar(entrada) { entradas.push(entrada); } };
}
