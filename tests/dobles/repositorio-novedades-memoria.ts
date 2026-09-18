import type { Novedad, RepositorioNovedades } from "@/domains/novedades/tipos";

export function repositorioNovedadesEnMemoria() {
  const novedades: Novedad[] = [];
  let secuencia = 0;

  const activasOrdenadas = (filtro: (n: Novedad) => boolean) =>
    novedades.filter((n) => filtro(n) && !n.archivada).sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());

  const repo: RepositorioNovedades = {
    async crear(datos) {
      const novedad = { ...datos, id: `novedad-${++secuencia}`, creadoEn: new Date() } as Novedad;
      novedades.push(novedad);
      return novedad;
    },
    async actualizar(id, cambios) {
      const i = novedades.findIndex((n) => n.id === id);
      if (i === -1) throw new Error("No existe la novedad");
      novedades[i] = { ...novedades[i], ...cambios };
      return novedades[i];
    },
    async porId(id) {
      return novedades.find((n) => n.id === id) ?? null;
    },
    async delCaso(casoId) {
      return activasOrdenadas((n) => n.casoId === casoId);
    },
    async delAnimal(animalId) {
      return activasOrdenadas((n) => n.animalId === animalId);
    },
    async todasDelCaso(casoId) {
      return novedades.filter((n) => n.casoId === casoId);
    },
    async todasDelAnimal(animalId) {
      return novedades.filter((n) => n.animalId === animalId);
    },
  };

  return Object.assign(repo, { novedades });
}
