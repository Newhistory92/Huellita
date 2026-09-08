import { exigirLecturaDeFinanzas, exigirPermisoSobreFinanzas } from "./casos";
import type { ContextoFinanzas, Documento } from "./tipos";

export interface EntradaDocumento {
  claveArchivo: string;
  nombre: string;
  tipo: string;
  datosPersonalesTachados: boolean;
}

/**
 * El archivo ya se subió al almacén antes de llamar a esta función: acá solo
 * se registra el metadato. Sin la confirmación explícita del tachado, el
 * documento queda privado — la §11 del sistema de diseño no da margen: el
 * botón no alcanza, hace falta que alguien lo confirme.
 */
export async function subirDocumento(entrada: EntradaDocumento, ctx: ContextoFinanzas): Promise<Documento> {
  exigirPermisoSobreFinanzas(ctx);

  const documento = await ctx.repositorio.crearDocumento({
    claveArchivo: entrada.claveArchivo,
    nombre: entrada.nombre,
    tipo: entrada.tipo,
    publico: entrada.datosPersonalesTachados,
    datosPersonalesTachados: entrada.datosPersonalesTachados,
    subidoPorEmail: ctx.usuarioEmail,
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "documento.subir",
    entidad: "Documento",
    entidadId: documento.id,
    valorNuevo: { nombre: documento.nombre, tipo: documento.tipo, publico: documento.publico },
  });
  return documento;
}

/**
 * A diferencia de `documentoPublico`, esta no filtra por `publico`: la usa el
 * panel para que quien verifica una transferencia vea el comprobante antes de
 * que alguien confirme el tachado de datos personales.
 */
export async function obtenerDocumento(id: string, ctx: ContextoFinanzas): Promise<Documento | null> {
  exigirLecturaDeFinanzas(ctx);
  return ctx.repositorio.documentoPorId(id);
}
