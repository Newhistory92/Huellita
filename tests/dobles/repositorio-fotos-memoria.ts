import type { Foto, RepositorioFotos } from "@/domains/animales/tipos";

export function repositorioFotosEnMemoria(iniciales: Foto[] = []): RepositorioFotos & { datos: Foto[] } {
  const datos = [...iniciales];
  let secuencia = datos.length;
  return {
    datos,
    async crear(entrada) {
      const foto = { ...entrada, id: `foto-${++secuencia}` } as Foto;
      datos.push(foto);
      return foto;
    },
    async listarPorAnimal(animalId) {
      return datos.filter((f) => f.animalId === animalId).sort((a, b) => a.orden - b.orden);
    },
    async porId(id) {
      return datos.find((f) => f.id === id) ?? null;
    },
    async actualizar(id, cambios) {
      const i = datos.findIndex((f) => f.id === id);
      if (i === -1) throw new Error("No existe la foto");
      datos[i] = { ...datos[i], ...cambios };
      return datos[i];
    },
    async reordenar(cambios) {
      for (const cambio of cambios) {
        const i = datos.findIndex((f) => f.id === cambio.id);
        if (i !== -1) datos[i] = { ...datos[i], orden: cambio.orden };
      }
    },
  };
}
