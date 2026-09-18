import { puede } from "@/domains/usuarios/autorizacion";
import type { ContextoNovedades, Foto, Novedad } from "./tipos";

export interface EntradaNovedad {
  casoId?: string | null;
  animalId?: string | null;
  titulo: string;
  cuerpo: string;
  foto?: Foto | null;
  documentoId?: string | null;
}

const LARGO_TITULO = 120;
const LARGO_CUERPO = 4000;

export function exigirPermisoSobreNovedades(ctx: ContextoNovedades): void {
  if (!puede(ctx.rol, "novedades.escribir")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para escribir novedades`);
  }
}

function validar(entrada: EntradaNovedad): { casoId: string | null; animalId: string | null; titulo: string; cuerpo: string } {
  const casoId = entrada.casoId ?? null;
  const animalId = entrada.animalId ?? null;

  // Exactamente uno. Colgada de los dos no se sabe dónde mostrarla; colgada de
  // ninguno no se muestra en ningún lado y queda invisible para siempre.
  if ((casoId === null) === (animalId === null)) {
    throw new Error("Una novedad tiene que colgar de exactamente un caso o un animal");
  }

  const titulo = entrada.titulo.trim();
  if (titulo.length === 0) throw new Error("La novedad necesita un título");
  if (titulo.length > LARGO_TITULO) throw new Error(`El título no puede pasar de ${LARGO_TITULO} caracteres`);

  const cuerpo = entrada.cuerpo.trim();
  if (cuerpo.length > LARGO_CUERPO) throw new Error(`El cuerpo no puede pasar de ${LARGO_CUERPO} caracteres`);

  return { casoId, animalId, titulo, cuerpo };
}

export async function crearNovedad(entrada: EntradaNovedad, ctx: ContextoNovedades): Promise<Novedad> {
  exigirPermisoSobreNovedades(ctx);
  const datos = validar(entrada);

  const novedad = await ctx.repositorio.crear({
    ...datos,
    foto: entrada.foto ?? null,
    documentoId: entrada.documentoId ?? null,
    autorEmail: ctx.usuarioEmail,
    // Crear es publicar: no hay borradores.
    archivada: false,
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "novedad.crear",
    entidad: "Novedad",
    entidadId: novedad.id,
    valorNuevo: { titulo: novedad.titulo, casoId: novedad.casoId, animalId: novedad.animalId },
  });
  return novedad;
}

/**
 * Una novedad se corrige: es contenido editorial, no un asiento contable. La
 * regla de solo agregado protege el dinero, no el texto.
 *
 * Lo que no se puede es mudarla de dueño: una novedad del caso de Luna que
 * aparece de golpe en la ficha de Juanito no es una corrección, es otra cosa.
 */
const CAMPOS_PROHIBIDOS = ["id", "casoId", "animalId", "autorEmail", "creadoEn"] as const;

export async function editarNovedad(
  id: string,
  cambios: Partial<Novedad>,
  ctx: ContextoNovedades
): Promise<Novedad> {
  exigirPermisoSobreNovedades(ctx);

  const anterior = await ctx.repositorio.porId(id);
  if (!anterior) throw new Error("No existe la novedad");

  const seguros = { ...cambios };
  for (const campo of CAMPOS_PROHIBIDOS) delete seguros[campo];

  if (seguros.titulo !== undefined || seguros.cuerpo !== undefined) {
    validar({
      casoId: anterior.casoId,
      animalId: anterior.animalId,
      titulo: seguros.titulo ?? anterior.titulo,
      cuerpo: seguros.cuerpo ?? anterior.cuerpo,
    });
  }

  const editada = await ctx.repositorio.actualizar(id, seguros);
  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "novedad.editar",
    entidad: "Novedad",
    entidadId: id,
    valorAnterior: { titulo: anterior.titulo },
    valorNuevo: { titulo: editada.titulo },
  });
  return editada;
}

export async function archivarNovedad(id: string, ctx: ContextoNovedades): Promise<Novedad> {
  exigirPermisoSobreNovedades(ctx);

  const anterior = await ctx.repositorio.porId(id);
  if (!anterior) throw new Error("No existe la novedad");

  const archivada = await ctx.repositorio.actualizar(id, { archivada: true });
  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "novedad.archivar",
    entidad: "Novedad",
    entidadId: id,
    valorAnterior: { archivada: false },
    valorNuevo: { archivada: true },
  });
  return archivada;
}
