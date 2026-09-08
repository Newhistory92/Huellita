import { generarSlug, slugDisponible } from "@/domains/animales/slug";
import { puede } from "@/domains/usuarios/autorizacion";
import { esquemaCaso, type EntradaCaso } from "./esquemas";
import type { Caso, ContextoFinanzas, FiltroCasos } from "./tipos";

/** El permiso se verifica acá, no en la pantalla: esconder un botón no es seguridad. */
export function exigirPermisoSobreFinanzas(ctx: ContextoFinanzas): void {
  if (!puede(ctx.rol, "finanzas.escribir")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para escribir movimientos de dinero`);
  }
}

export function exigirLecturaDeFinanzas(ctx: ContextoFinanzas): void {
  if (!puede(ctx.rol, "finanzas.leer")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para ver las finanzas`);
  }
}

export async function exigirCaso(id: string, ctx: ContextoFinanzas): Promise<Caso> {
  const caso = await ctx.repositorio.casoPorId(id);
  if (!caso) throw new Error("No existe el caso");
  return caso;
}

/** Lista todos los casos para el panel, sin el recorte que aplica la consulta pública. */
export async function listarCasosFinanzas(filtro: FiltroCasos, ctx: ContextoFinanzas): Promise<Caso[]> {
  exigirLecturaDeFinanzas(ctx);
  return ctx.repositorio.listarCasos(filtro);
}

export async function obtenerCaso(id: string, ctx: ContextoFinanzas): Promise<Caso> {
  exigirLecturaDeFinanzas(ctx);
  return exigirCaso(id, ctx);
}

export async function crearCaso(entrada: EntradaCaso, ctx: ContextoFinanzas): Promise<Caso> {
  exigirPermisoSobreFinanzas(ctx);
  const datos = esquemaCaso.parse(entrada);
  const existentes = await ctx.repositorio.slugsDeCasos();
  const slug = slugDisponible(generarSlug(datos.titulo), existentes);

  const caso = await ctx.repositorio.crearCaso({
    ...datos,
    slug,
    estado: "ABIERTO",
    recibidoCentavos: 0n,
    gastadoCentavos: 0n,
    cantidadDonantes: 0,
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "caso.crear",
    entidad: "CasoFinanciero",
    entidadId: caso.id,
    valorNuevo: { titulo: caso.titulo, metaCentavos: caso.metaCentavos.toString() },
  });
  return caso;
}

/** Campos que ninguna edición puede tocar: la dirección es permanente y los saldos son derivados. */
const CAMPOS_PROHIBIDOS = ["slug", "recibidoCentavos", "gastadoCentavos", "cantidadDonantes"] as const;

export async function editarCaso(id: string, cambios: Partial<Caso>, ctx: ContextoFinanzas): Promise<Caso> {
  exigirPermisoSobreFinanzas(ctx);
  const anterior = await exigirCaso(id, ctx);

  const seguros = { ...cambios };
  for (const campo of CAMPOS_PROHIBIDOS) delete seguros[campo];

  const editado = await ctx.repositorio.actualizarCaso(id, seguros);
  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "caso.editar",
    entidad: "CasoFinanciero",
    entidadId: id,
    valorAnterior: { titulo: anterior.titulo, metaCentavos: anterior.metaCentavos.toString() },
    valorNuevo: { titulo: editado.titulo, metaCentavos: editado.metaCentavos.toString() },
  });
  return editado;
}

export async function cerrarCaso(id: string, ctx: ContextoFinanzas): Promise<Caso> {
  exigirPermisoSobreFinanzas(ctx);
  const anterior = await exigirCaso(id, ctx);
  const cerrado = await ctx.repositorio.actualizarCaso(id, { estado: "CERRADO" });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "caso.cerrar",
    entidad: "CasoFinanciero",
    entidadId: id,
    valorAnterior: { estado: anterior.estado },
    valorNuevo: { estado: "CERRADO" },
  });
  return cerrado;
}
