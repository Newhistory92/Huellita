import type { AvisoPendiente, NuevoAviso, RepositorioAvisos, Rol } from "@/domains/avisos/tipos";

export function repositorioAvisosEnMemoria(correosPorRol: Partial<Record<Rol, string[]>> = {}) {
  const avisos: AvisoPendiente[] = [];
  let secuencia = 0;

  const repo: RepositorioAvisos = {
    async anotar(nuevo: NuevoAviso) {
      avisos.push({
        id: `aviso-${++secuencia}`,
        tipo: nuevo.tipo,
        datos: nuevo.datos,
        originadoPorEmail: nuevo.originadoPorEmail ?? null,
        creadoEn: new Date(),
        enviadoEn: null,
        intentos: 0,
        ultimoError: null,
      });
    },
    async pendientes(limite, maxIntentos) {
      return avisos
        .filter((a) => a.enviadoEn === null && a.intentos < maxIntentos)
        .sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime())
        .slice(0, limite);
    },
    async marcarEnviados(ids, cuando) {
      for (const aviso of avisos) if (ids.includes(aviso.id)) aviso.enviadoEn = cuando;
    },
    async registrarFallo(ids, error) {
      for (const aviso of avisos) {
        if (ids.includes(aviso.id)) {
          aviso.intentos += 1;
          aviso.ultimoError = error;
        }
      }
    },
    async correosDeRoles(roles) {
      const correos = roles.flatMap((rol) => correosPorRol[rol] ?? []);
      return [...new Set(correos)];
    },
  };

  return Object.assign(repo, { avisos });
}
