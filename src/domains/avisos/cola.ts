import { rolesQueReciben, redactar } from "./redaccion";
import type { AvisoPendiente, ContextoAvisos, NuevoAviso, PuertoAvisos, RepositorioAvisos } from "./tipos";

/** Después de esto deja de reintentar y el aviso queda visible como fallido. */
export const MAX_INTENTOS = 5;

/**
 * Tope por corrida, para que una no se eternice ni agote el límite del
 * proveedor. Lo que sobra sale en la siguiente.
 */
export const TOPE_POR_CORRIDA = 200;

export interface ResumenDelVaciado {
  enviados: number;
  fallidos: number;
  correos: number;
}

/** Lo que el dominio usa para anotar: solo una escritura, dentro de la transacción. */
export function puertoAvisos(repositorio: RepositorioAvisos): PuertoAvisos {
  return {
    async anotar(aviso: NuevoAviso) {
      await repositorio.anotar(aviso);
    },
  };
}

/**
 * Lee los avisos pendientes, los agrupa por destinatario y manda un correo a
 * cada uno.
 *
 * Agrupar no es una optimización: si entraron veinte donaciones y salieran
 * veinte correos, la asociación apagaría las notificaciones en una semana. Un
 * sistema de avisos falla cuando consigue que lo desactiven, no cuando manda
 * de menos.
 */
export async function vaciarCola(ctx: ContextoAvisos, urlBase: string): Promise<ResumenDelVaciado> {
  const pendientes = await ctx.repositorio.pendientes(TOPE_POR_CORRIDA, MAX_INTENTOS);
  if (pendientes.length === 0) return { enviados: 0, fallidos: 0, correos: 0 };

  // Los destinatarios se resuelven ahora, no cuando se anotó: quien se sumó al
  // equipo entre medio recibe lo pendiente, y quien se fue deja de recibirlo.
  const porDestinatario = new Map<string, AvisoPendiente[]>();
  const sinDestinatario: string[] = [];

  for (const aviso of pendientes) {
    const correos = await ctx.repositorio.correosDeRoles(rolesQueReciben(aviso.tipo));
    const destinatarios = correos.filter((correo) => correo !== aviso.originadoPorEmail);

    if (destinatarios.length === 0) {
      // Sin nadie a quien avisarle no hay nada que reintentar: se marca
      // enviado para que no quede trabado en la cola para siempre.
      sinDestinatario.push(aviso.id);
      continue;
    }

    for (const destinatario of destinatarios) {
      const suyos = porDestinatario.get(destinatario) ?? [];
      suyos.push(aviso);
      porDestinatario.set(destinatario, suyos);
    }
  }

  const enviadosOk = new Set<string>();
  const fallados = new Map<string, string>();
  let correosMandados = 0;

  for (const [destinatario, avisos] of porDestinatario) {
    const { asunto, cuerpo } = redactar(avisos, urlBase);
    try {
      await ctx.correo.enviar({ para: [destinatario], asunto, cuerpo });
      correosMandados++;
      for (const aviso of avisos) enviadosOk.add(aviso.id);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      for (const aviso of avisos) fallados.set(aviso.id, mensaje);
    }
  }

  // Un aviso que salió para alguien y falló para otro cuenta como enviado: se
  // entregó. Reintentarlo mandaría el correo repetido a quien ya lo recibió.
  for (const id of enviadosOk) fallados.delete(id);

  const ahora = new Date();
  const paraMarcar = [...enviadosOk, ...sinDestinatario];
  if (paraMarcar.length > 0) await ctx.repositorio.marcarEnviados(paraMarcar, ahora);

  for (const [id, mensaje] of fallados) {
    await ctx.repositorio.registrarFallo([id], mensaje);
  }

  return { enviados: paraMarcar.length, fallidos: fallados.size, correos: correosMandados };
}
