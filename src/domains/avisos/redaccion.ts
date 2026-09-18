import type { AvisoPendiente, Rol, TipoAviso } from "./tipos";

/** La tabla de la §5.1 de la especificación. */
const DESTINATARIOS: Record<TipoAviso, Rol[]> = {
  POSTULACION_NUEVA: ["ANIMALES", "ADMINISTRACION"],
  TRANSFERENCIA_PENDIENTE: ["FINANZAS", "ADMINISTRACION"],
  DONACION_VERIFICADA: ["FINANZAS", "ADMINISTRACION"],
  META_ALCANZADA: ["FINANZAS", "ADMINISTRACION"],
};

export function rolesQueReciben(tipo: TipoAviso): Rol[] {
  return DESTINATARIOS[tipo];
}

function texto(datos: Record<string, unknown>, clave: string, porDefecto: string): string {
  const valor = datos[clave];
  return typeof valor === "string" && valor.length > 0 ? valor : porDefecto;
}

/** Una línea por aviso: qué pasó y dónde resolverlo. */
function linea(aviso: AvisoPendiente, urlBase: string): string {
  const d = aviso.datos;

  switch (aviso.tipo) {
    case "POSTULACION_NUEVA": {
      const animal = texto(d, "nombreAnimal", "un animal");
      const id = texto(d, "postulacionId", "");
      const enlace = id ? `${urlBase}/panel/postulaciones/${id}` : `${urlBase}/panel/postulaciones`;
      return `• Llegó una postulación para ${animal}.\n  ${enlace}`;
    }
    case "TRANSFERENCIA_PENDIENTE": {
      const caso = texto(d, "tituloCaso", "un caso");
      const monto = texto(d, "montoTexto", "");
      const porCuanto = monto ? ` por ${monto}` : "";
      return `• Alguien declaró una transferencia${porCuanto} para ${caso}. Falta verificarla contra el extracto.\n  ${urlBase}/panel/finanzas/transferencias`;
    }
    case "DONACION_VERIFICADA": {
      const caso = texto(d, "tituloCaso", "un caso");
      const monto = texto(d, "montoTexto", "");
      const deCuanto = monto ? ` de ${monto}` : "";
      return `• Entró una donación verificada${deCuanto} en ${caso}.\n  ${urlBase}/panel/finanzas`;
    }
    case "META_ALCANZADA": {
      const caso = texto(d, "tituloCaso", "un caso");
      return `• ${caso} alcanzó la meta. Sigue recibiendo donaciones; el excedente queda como saldo del caso.\n  ${urlBase}/panel/finanzas`;
    }
  }
}

const TITULO_POR_TIPO: Record<TipoAviso, string> = {
  POSTULACION_NUEVA: "una postulación nueva",
  TRANSFERENCIA_PENDIENTE: "una transferencia por verificar",
  DONACION_VERIFICADA: "una donación verificada",
  META_ALCANZADA: "un caso que alcanzó la meta",
};

/**
 * Texto plano con un enlace al panel por cada cosa que pasó. No HTML con
 * diseño: son avisos internos, quien los recibe quiere saber qué pasó y entrar
 * a resolverlo. El texto plano además no se rompe en ningún cliente de correo.
 */
export function redactar(avisos: AvisoPendiente[], urlBase: string): { asunto: string; cuerpo: string } {
  const base = urlBase.replace(/\/+$/, "");

  const asunto =
    avisos.length === 1
      ? `Huellas: ${TITULO_POR_TIPO[avisos[0].tipo]}${
          typeof avisos[0].datos.nombreAnimal === "string" ? ` para ${avisos[0].datos.nombreAnimal}` : ""
        }`
      : `Huellas: ${avisos.length} cosas para revisar`;

  const cuerpo = [
    avisos.length === 1 ? "Pasó esto en la plataforma:" : `Pasaron ${avisos.length} cosas en la plataforma:`,
    "",
    ...avisos.map((aviso) => linea(aviso, base)),
    "",
    "Este aviso se manda solo. No hace falta responderlo.",
  ].join("\n");

  return { asunto, cuerpo };
}
