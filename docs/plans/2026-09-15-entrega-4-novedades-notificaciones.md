# Entrega 4 — Novedades y notificaciones: Plan de implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Que el caso financiero cuente qué pasó y no solo cuánta plata entró, y que la asociación deje de tener que entrar al panel para enterarse de que llegó algo.

**Arquitectura:** Se sigue el patrón de las entregas anteriores. Las novedades son un dominio nuevo con su puerto. Las notificaciones usan una cola en la base: el dominio anota que hay que avisar dentro de la misma transacción que la acción —igual que ya hace con la auditoría— y un proceso aparte vacía la cola y manda los correos a través de un puerto.

**Stack:** El de las entregas anteriores, más el SDK de Resend en la mitad 4B.

**Spec:** [docs/specs/2026-09-15-entrega-4-novedades-notificaciones-design.md](../specs/2026-09-15-entrega-4-novedades-notificaciones-design.md)
**Sistema de diseño:** [docs/specs/2026-09-02-sistema-diseno-v1.md](../specs/2026-09-02-sistema-diseno-v1.md)

## Flujo de trabajo con el grafo (obligatorio)

Esto va antes que cualquier tarea y se respeta durante todo el plan:

1. **Antes de empezar:** construir el grafo con `/graphify` (o actualizarlo con `/graphify . --update` si `graphify-out/` ya existe). Recién después, crear la rama de trabajo: `git checkout -b entrega-4-novedades-notificaciones`.
2. **Cada vez que haya que buscar algo en el proyecto** —dónde vive una función, quién llama a qué, qué patrón seguir— se busca **a través del grafo** (`graphify-out/GRAPH_REPORT.md` y las consultas de la skill), no a ciegas. Grep queda solo para confirmar una firma exacta que el grafo ya ubicó.
3. **Al empezar cada mitad (4A y 4B)**, consultar el grafo por los archivos que la mitad toca antes de abrirlos.
4. **Antes de cualquier push a `main` o de fusionar la rama:** actualizar el grafo con `/graphify . --update`. Sin grafo actualizado no se fusiona.

## Restricciones globales

Aplican a **todas** las tareas.

- **Las páginas y los componentes nunca acceden a la base de datos directamente.** Toda lectura y escritura pasa por una función de dominio.
- **El dominio nunca manda un correo.** Anota que hay que avisar; el envío ocurre fuera de la transacción, en el vaciado de la cola.
- **Los permisos se verifican en la capa de dominio, no escondiendo botones.** Las novedades las escriben `ADMINISTRACION`, `ANIMALES` y `REDACCION`; `FINANZAS` no.
- **Se avisa lo que llega de afuera o lo que decide el sistema, nunca lo que hizo una persona del equipo**, y jamás a quien ejecutó la acción.
- **Los destinatarios se resuelven al enviar, no al anotar.**
- **Las novedades se archivan, no se borran.** Una archivada no aparece en ninguna página pública.
- **Una novedad cuelga de exactamente un caso o un animal:** ni de los dos, ni de ninguno.
- **La auditoría se escribe en la misma transacción que la acción.**
- **`unstable_cache` no sabe serializar `BigInt` ni reconstruir `Date`:** toda consulta cacheada pasa por `paraCache` y `desdeCache` de `@/domains/finanzas/consultas`.
- **Si una tarea arrastra un arreglo de una tarea anterior, va en un commit aparte** del `feat` que le toca.
- **Ojo con el nombre "aviso":** en `src/domains/pagos/procesar-aviso.ts`, `Aviso` y `procesarAviso` ya existen y son **la notificación que manda Mercado Pago**. Lo nuevo de esta entrega vive en `src/domains/avisos/` y son **avisos internos al equipo** (`AvisoPendiente`). No mezclar ni renombrar lo existente.
- **Idioma:** todo en castellano rioplatense — código, nombres, comentarios, commits y pantallas.
- TypeScript estricto. Sin `any` salvo con comentario que lo justifique.

## Las dos mitades

**4A — Novedades (tareas 1 a 6).** Cierra el desvío anotado en el plan de la entrega 2. No depende de Resend ni de ninguna cuenta nueva.

**4B — Notificaciones (tareas 7 a 12).** Cola, puerto de correo, adaptador de Resend y ruta de vaciado.

---

## Estructura de archivos

```
prisma/
  schema.prisma                     + Novedad, AvisoPendiente, TipoAviso
src/
  domains/novedades/
    tipos.ts                        Tipos y puerto del repositorio
    servicio.ts                     Crear, editar, archivar
    consultas.ts                    Lecturas públicas, cacheadas
  domains/avisos/
    tipos.ts                        TipoAviso, PuertoAvisos, ProveedorDeCorreo
    cola.ts                         anotarAviso y vaciarCola
    redaccion.ts                    De hechos a asunto y cuerpo
  infra/
    repositorios/novedades.ts
    repositorios/avisos.ts
    correo/tipos.ts                 Reexporta el puerto
    correo/consola.ts               Escribe el correo en la salida estándar
    correo/resend.ts                Adaptador de Resend
    correo/index.ts                 Elige implementación por configuración
    contexto-novedades.ts
  app/
    ayudar/[slug]/Pestanas.tsx      + cuarta pestaña
    adopcion/[slug]/page.tsx        + novedades del animal
    api/tareas/avisos/route.ts      Vaciado de la cola
    panel/(protegido)/novedades/…   Escribir y archivar novedades
  ui/novedades/
    ListaDeNovedades.tsx            Se usa en el caso y en la ficha
tests/
  unidad/novedades-*.test.ts
  unidad/avisos-*.test.ts
  dobles/repositorio-novedades-memoria.ts
  dobles/proveedor-correo-falso.ts
  integracion/novedades-*.test.ts
```

---

# Mitad 4A — Novedades

## Tarea 1: Modelo de novedades

**Archivos:**
- Modificar: `prisma/schema.prisma`
- Crear: la migración generada
- Prueba: `tests/integracion/novedades-modelo.test.ts`

**Interfaces:**
- Consume: el esquema de las entregas 1 a 3.
- Produce: el modelo `Novedad` y sus relaciones inversas.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/integracion/novedades-modelo.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const animales: string[] = [];
const casos: string[] = [];
const novedades: string[] = [];

afterAll(async () => {
  await prisma.novedad.deleteMany({ where: { id: { in: novedades } } });
  await prisma.casoFinanciero.deleteMany({ where: { id: { in: casos } } });
  await prisma.animal.deleteMany({ where: { id: { in: animales } } });
  await prisma.$disconnect();
});

const sufijo = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function animalDePrueba() {
  const animal = await prisma.animal.create({
    data: {
      slug: `novedades-${sufijo()}`,
      nombre: "Juanito",
      especie: "PERRO",
      sexo: "MACHO",
      tamano: "MEDIANO",
      descripcion: "Descripción de prueba suficientemente larga para pasar la validación.",
    },
  });
  animales.push(animal.id);
  return animal;
}

async function casoDePrueba() {
  const caso = await prisma.casoFinanciero.create({
    data: { slug: `caso-novedades-${sufijo()}`, titulo: "Caso", situacion: "x", metaCentavos: 100000n },
  });
  casos.push(caso.id);
  return caso;
}

describe("modelo de novedades", () => {
  it("guarda una novedad colgada de un caso", async () => {
    const caso = await casoDePrueba();
    const novedad = await prisma.novedad.create({
      data: { casoId: caso.id, titulo: "Luna salió bien de la cirugía", cuerpo: "Está estable.", autorEmail: "marina@huellas.org.ar" },
    });
    novedades.push(novedad.id);

    expect(novedad.animalId).toBeNull();
    expect(novedad.archivada).toBe(false);
  });

  it("guarda una novedad colgada de un animal, con foto", async () => {
    const animal = await animalDePrueba();
    const novedad = await prisma.novedad.create({
      data: {
        animalId: animal.id,
        titulo: "Juanito ya está recuperado",
        cuerpo: "Come bien y duerme panza arriba.",
        autorEmail: "marina@huellas.org.ar",
        fotoClave: "novedades/abc",
        fotoAlt: "Juanito durmiendo panza arriba",
        fotoAncho: 1200,
        fotoAlto: 900,
        fotoPlaceholder: "data:image/webp;base64,xx",
      },
    });
    novedades.push(novedad.id);

    expect(novedad.casoId).toBeNull();
    expect(novedad.fotoAlt).toBe("Juanito durmiendo panza arriba");
  });

  it("se puede leer desde el caso y desde el animal", async () => {
    const caso = await casoDePrueba();
    const novedad = await prisma.novedad.create({
      data: { casoId: caso.id, titulo: "Actualización", cuerpo: "x", autorEmail: "a@b.c" },
    });
    novedades.push(novedad.id);

    const conNovedades = await prisma.casoFinanciero.findUnique({
      where: { id: caso.id },
      include: { novedades: true },
    });
    expect(conNovedades!.novedades).toHaveLength(1);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/integracion/novedades-modelo.test.ts`
Esperado: FALLA — `prisma.novedad` no existe.

- [ ] **Paso 3: Agregar el modelo**

En `prisma/schema.prisma`, copiar el bloque de la §3.1 de la especificación. Agregar las **tres relaciones inversas** que Prisma exige:

```prisma
model CasoFinanciero {
  // ... campos existentes
  novedades Novedad[]
}

model Animal {
  // ... campos existentes
  novedades Novedad[]
}

model Documento {
  // ... campos existentes
  novedades Novedad[]
}
```

- [ ] **Paso 4: Generar y aplicar la migración**

```bash
npx prisma migrate dev --name entrega_4_novedades
```

- [ ] **Paso 5: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/integracion/novedades-modelo.test.ts`
Esperado: PASAN las 3.

- [ ] **Paso 6: Confirmar**

```bash
git add prisma tests/integracion/novedades-modelo.test.ts
git commit -m "feat: modelo de novedades

Una novedad cuelga de un caso o de un animal. La foto va desarmada en
columnas en vez de reutilizar FotoAnimal, que arrastra orden, principal
y sensible: conceptos que no significan nada para una novedad."
```

---

## Tarea 2: Tipos, puerto y doble en memoria

**Archivos:**
- Crear: `src/domains/novedades/tipos.ts`, `tests/dobles/repositorio-novedades-memoria.ts`

**Interfaces:**
- Consume: `PuertoAuditoria` de `@/domains/animales/tipos`.
- Produce: `Novedad`, `RepositorioNovedades`, `ContextoNovedades`, `repositorioNovedadesEnMemoria()`.

- [ ] **Paso 1: Definir los tipos**

Crear `src/domains/novedades/tipos.ts`:

```ts
import type { PuertoAuditoria } from "@/domains/animales/tipos";

export type Rol = "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";

export interface Foto {
  clave: string;
  alt: string;
  ancho: number;
  alto: number;
  placeholder: string;
}

export interface Novedad {
  id: string;
  /** Exactamente uno de los dos tiene valor. Ver §3.2 de la especificación. */
  casoId: string | null;
  animalId: string | null;
  titulo: string;
  cuerpo: string;
  foto: Foto | null;
  documentoId: string | null;
  autorEmail: string;
  archivada: boolean;
  creadoEn: Date;
}

export interface RepositorioNovedades {
  crear(datos: Omit<Novedad, "id" | "creadoEn">): Promise<Novedad>;
  actualizar(id: string, cambios: Partial<Novedad>): Promise<Novedad>;
  porId(id: string): Promise<Novedad | null>;
  /** Solo las activas, de la más nueva a la más vieja. */
  delCaso(casoId: string): Promise<Novedad[]>;
  delAnimal(animalId: string): Promise<Novedad[]>;
  /** Incluye archivadas: lo usa el panel. */
  todasDelCaso(casoId: string): Promise<Novedad[]>;
  todasDelAnimal(animalId: string): Promise<Novedad[]>;
}

export interface ContextoNovedades {
  usuarioEmail: string;
  rol: Rol;
  repositorio: RepositorioNovedades;
  auditoria: PuertoAuditoria;
}
```

- [ ] **Paso 2: Crear el doble en memoria**

Crear `tests/dobles/repositorio-novedades-memoria.ts`:

```ts
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
```

- [ ] **Paso 3: Verificar que compila**

Ejecutar: `npx tsc --noEmit`
Esperado: sin errores.

- [ ] **Paso 4: Confirmar**

```bash
git add src/domains/novedades/tipos.ts tests/dobles/repositorio-novedades-memoria.ts
git commit -m "feat: tipos y puerto del dominio novedades"
```

---

## Tarea 3: Crear, editar y archivar novedades

**Archivos:**
- Crear: `src/domains/novedades/servicio.ts`
- Prueba: `tests/unidad/novedades-servicio.test.ts`

**Interfaces:**
- Consume: `ContextoNovedades`, `puede` de `@/domains/usuarios/autorizacion`.
- Produce: `crearNovedad(entrada, ctx)`, `editarNovedad(id, cambios, ctx)`, `archivarNovedad(id, ctx)`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/novedades-servicio.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { crearNovedad, editarNovedad, archivarNovedad } from "@/domains/novedades/servicio";
import { repositorioNovedadesEnMemoria } from "../dobles/repositorio-novedades-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import type { Rol } from "@/domains/novedades/tipos";

function contexto(rol: Rol = "REDACCION") {
  return {
    usuarioEmail: "marina@huellas.org.ar",
    rol,
    repositorio: repositorioNovedadesEnMemoria(),
    auditoria: auditoriaEnMemoria(),
  };
}

const base = { casoId: "caso-1", titulo: "Luna salió bien de la cirugía", cuerpo: "Está estable y comiendo." };

describe("crearNovedad", () => {
  it("nace publicada: no hay borradores", async () => {
    const novedad = await crearNovedad(base, contexto());
    expect(novedad.archivada).toBe(false);
    expect(novedad.creadoEn).toBeInstanceOf(Date);
  });

  it("guarda quién la escribió", async () => {
    const novedad = await crearNovedad(base, contexto());
    expect(novedad.autorEmail).toBe("marina@huellas.org.ar");
  });

  it("acepta una novedad colgada de un animal", async () => {
    const novedad = await crearNovedad({ animalId: "animal-1", titulo: "Juanito ya está recuperado", cuerpo: "Come bien." }, contexto());
    expect(novedad.animalId).toBe("animal-1");
    expect(novedad.casoId).toBeNull();
  });

  // La regla de la §3.2: exactamente uno. Ni los dos, ni ninguno.
  it("rechaza una novedad colgada de un caso Y de un animal", async () => {
    await expect(
      crearNovedad({ casoId: "caso-1", animalId: "animal-1", titulo: "Doble", cuerpo: "No debería poder." }, contexto())
    ).rejects.toThrow(/exactamente un/i);
  });

  it("rechaza una novedad que no cuelga de nada", async () => {
    await expect(crearNovedad({ titulo: "Huérfana", cuerpo: "No cuelga de nada." }, contexto())).rejects.toThrow(/exactamente un/i);
  });

  it("rechaza un título vacío", async () => {
    await expect(crearNovedad({ ...base, titulo: "   " }, contexto())).rejects.toThrow(/título/i);
  });

  it("rechaza un título de más de 120 caracteres", async () => {
    await expect(crearNovedad({ ...base, titulo: "a".repeat(121) }, contexto())).rejects.toThrow(/120/);
  });

  it("rechaza un cuerpo de más de 4000 caracteres", async () => {
    await expect(crearNovedad({ ...base, cuerpo: "a".repeat(4001) }, contexto())).rejects.toThrow(/4000/);
  });

  it("el rol de finanzas no escribe novedades: solo escribe dinero", async () => {
    await expect(crearNovedad(base, contexto("FINANZAS"))).rejects.toThrow(/permiso/i);
  });

  it("redacción sí puede", async () => {
    await expect(crearNovedad(base, contexto("REDACCION"))).resolves.toBeDefined();
  });

  it("deja rastro en auditoría", async () => {
    const ctx = contexto();
    const novedad = await crearNovedad(base, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas.at(-1)).toMatchObject({ accion: "novedad.crear", entidadId: novedad.id });
  });
});

describe("editarNovedad", () => {
  it("corrige el texto: no es un asiento contable", async () => {
    const ctx = contexto();
    const novedad = await crearNovedad(base, ctx);
    const editada = await editarNovedad(novedad.id, { titulo: "Luna salió muy bien de la cirugía" }, ctx);
    expect(editada.titulo).toBe("Luna salió muy bien de la cirugía");
  });

  it("no permite mudarla de un caso a un animal", async () => {
    const ctx = contexto();
    const novedad = await crearNovedad(base, ctx);
    const editada = await editarNovedad(novedad.id, { animalId: "animal-1" } as never, ctx);
    expect(editada.animalId).toBeNull();
    expect(editada.casoId).toBe("caso-1");
  });
});

describe("archivarNovedad", () => {
  it("la archiva en vez de borrarla", async () => {
    const ctx = contexto();
    const novedad = await crearNovedad(base, ctx);
    const archivada = await archivarNovedad(novedad.id, ctx);

    expect(archivada.archivada).toBe(true);
    expect(await ctx.repositorio.porId(novedad.id)).not.toBeNull();
  });

  it("una archivada desaparece de las del caso", async () => {
    const ctx = contexto();
    const novedad = await crearNovedad(base, ctx);
    await archivarNovedad(novedad.id, ctx);
    expect(await ctx.repositorio.delCaso("caso-1")).toHaveLength(0);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/novedades-servicio.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/novedades/servicio.ts`:

```ts
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
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/novedades-servicio.test.ts`
Esperado: PASAN las 15.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/novedades/servicio.ts tests/unidad/novedades-servicio.test.ts
git commit -m "feat: crear, editar y archivar novedades

Exactamente un dueño: colgada de los dos no se sabe dónde mostrarla,
colgada de ninguno queda invisible para siempre."
```

---

## Tarea 4: Repositorio Prisma y consultas

**Archivos:**
- Crear: `src/infra/repositorios/novedades.ts`, `src/infra/contexto-novedades.ts`, `src/domains/novedades/consultas.ts`
- Prueba: `tests/integracion/novedades-repositorio.test.ts`

**Interfaces:**
- Consume: el puerto `RepositorioNovedades`, `prisma`, `paraCache`/`desdeCache`.
- Produce: `repositorioNovedadesPrisma(cliente?)`, `contextoNovedades()`, `novedadesDelCaso(casoId)`, `novedadesDelAnimal(animalId)`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/integracion/novedades-repositorio.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { repositorioNovedadesPrisma } from "@/infra/repositorios/novedades";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearNovedad, archivarNovedad } from "@/domains/novedades/servicio";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const casos: string[] = [];

afterAll(async () => {
  await prisma.novedad.deleteMany({ where: { casoId: { in: casos } } });
  await prisma.casoFinanciero.deleteMany({ where: { id: { in: casos } } });
  await prisma.$disconnect();
});

async function casoDePrueba() {
  const caso = await prisma.casoFinanciero.create({
    data: {
      slug: `novedades-repo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      titulo: "Caso",
      situacion: "x",
      metaCentavos: 100000n,
    },
  });
  casos.push(caso.id);
  return caso;
}

function contexto(tx: PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) {
  return {
    usuarioEmail: "prueba@huellas.org.ar",
    rol: "REDACCION" as const,
    repositorio: repositorioNovedadesPrisma(tx as never),
    auditoria: auditoriaPrisma(tx as never),
  };
}

describe("repositorio Prisma de novedades", () => {
  it("guarda y devuelve la foto armada", async () => {
    const caso = await casoDePrueba();
    const novedad = await prisma.$transaction(async (tx) =>
      crearNovedad(
        {
          casoId: caso.id,
          titulo: "Con foto",
          cuerpo: "x",
          foto: { clave: "novedades/abc", alt: "Una foto", ancho: 1200, alto: 900, placeholder: "data:image/webp;base64,xx" },
        },
        contexto(tx)
      )
    );

    const leida = await repositorioNovedadesPrisma(prisma).porId(novedad.id);
    expect(leida!.foto).toEqual({
      clave: "novedades/abc",
      alt: "Una foto",
      ancho: 1200,
      alto: 900,
      placeholder: "data:image/webp;base64,xx",
    });
  });

  it("una novedad sin foto la devuelve en nulo, no a medias", async () => {
    const caso = await casoDePrueba();
    const novedad = await prisma.$transaction(async (tx) =>
      crearNovedad({ casoId: caso.id, titulo: "Sin foto", cuerpo: "x" }, contexto(tx))
    );
    const leida = await repositorioNovedadesPrisma(prisma).porId(novedad.id);
    expect(leida!.foto).toBeNull();
  });

  it("las archivadas no salen en las del caso, pero sí en todas", async () => {
    const caso = await casoDePrueba();
    const novedad = await prisma.$transaction(async (tx) =>
      crearNovedad({ casoId: caso.id, titulo: "Para archivar", cuerpo: "x" }, contexto(tx))
    );
    await prisma.$transaction(async (tx) => archivarNovedad(novedad.id, contexto(tx)));

    const repo = repositorioNovedadesPrisma(prisma);
    expect(await repo.delCaso(caso.id)).toHaveLength(0);
    expect(await repo.todasDelCaso(caso.id)).toHaveLength(1);
  });

  it("las devuelve de la más nueva a la más vieja", async () => {
    const caso = await casoDePrueba();
    await prisma.$transaction(async (tx) => crearNovedad({ casoId: caso.id, titulo: "Primera", cuerpo: "x" }, contexto(tx)));
    await new Promise((r) => setTimeout(r, 10));
    await prisma.$transaction(async (tx) => crearNovedad({ casoId: caso.id, titulo: "Segunda", cuerpo: "x" }, contexto(tx)));

    const leidas = await repositorioNovedadesPrisma(prisma).delCaso(caso.id);
    expect(leidas.map((n) => n.titulo)).toEqual(["Segunda", "Primera"]);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/integracion/novedades-repositorio.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar el repositorio**

Crear `src/infra/repositorios/novedades.ts`:

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import type { Novedad, RepositorioNovedades } from "@/domains/novedades/tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

/** La base guarda la foto desarmada en columnas; el dominio la ve como un objeto. */
type FilaNovedad = {
  id: string;
  casoId: string | null;
  animalId: string | null;
  titulo: string;
  cuerpo: string;
  fotoClave: string | null;
  fotoAlt: string | null;
  fotoAncho: number | null;
  fotoAlto: number | null;
  fotoPlaceholder: string | null;
  documentoId: string | null;
  autorEmail: string;
  archivada: boolean;
  creadoEn: Date;
};

function aDominio(fila: FilaNovedad): Novedad {
  return {
    id: fila.id,
    casoId: fila.casoId,
    animalId: fila.animalId,
    titulo: fila.titulo,
    cuerpo: fila.cuerpo,
    // O están todos los campos de la foto, o no hay foto. Nunca a medias.
    foto:
      fila.fotoClave && fila.fotoAlt
        ? {
            clave: fila.fotoClave,
            alt: fila.fotoAlt,
            ancho: fila.fotoAncho ?? 0,
            alto: fila.fotoAlto ?? 0,
            placeholder: fila.fotoPlaceholder ?? "",
          }
        : null,
    documentoId: fila.documentoId,
    autorEmail: fila.autorEmail,
    archivada: fila.archivada,
    creadoEn: fila.creadoEn,
  };
}

function aFila(datos: Partial<Novedad>) {
  const { foto, ...resto } = datos;
  if (foto === undefined) return resto;
  return {
    ...resto,
    fotoClave: foto?.clave ?? null,
    fotoAlt: foto?.alt ?? null,
    fotoAncho: foto?.ancho ?? null,
    fotoAlto: foto?.alto ?? null,
    fotoPlaceholder: foto?.placeholder ?? null,
  };
}

export function repositorioNovedadesPrisma(cliente: ClienteBase = clientePorDefecto): RepositorioNovedades {
  const masNuevasPrimero = { orderBy: { creadoEn: "desc" } } as const;

  return {
    async crear(datos) {
      return aDominio((await cliente.novedad.create({ data: aFila(datos) as never })) as FilaNovedad);
    },
    async actualizar(id, cambios) {
      return aDominio((await cliente.novedad.update({ where: { id }, data: aFila(cambios) as never })) as FilaNovedad);
    },
    async porId(id) {
      const fila = (await cliente.novedad.findUnique({ where: { id } })) as FilaNovedad | null;
      return fila ? aDominio(fila) : null;
    },
    async delCaso(casoId) {
      const filas = (await cliente.novedad.findMany({ where: { casoId, archivada: false }, ...masNuevasPrimero })) as FilaNovedad[];
      return filas.map(aDominio);
    },
    async delAnimal(animalId) {
      const filas = (await cliente.novedad.findMany({ where: { animalId, archivada: false }, ...masNuevasPrimero })) as FilaNovedad[];
      return filas.map(aDominio);
    },
    async todasDelCaso(casoId) {
      const filas = (await cliente.novedad.findMany({ where: { casoId }, ...masNuevasPrimero })) as FilaNovedad[];
      return filas.map(aDominio);
    },
    async todasDelAnimal(animalId) {
      const filas = (await cliente.novedad.findMany({ where: { animalId }, ...masNuevasPrimero })) as FilaNovedad[];
      return filas.map(aDominio);
    },
  };
}
```

- [ ] **Paso 4: Implementar el contexto y las consultas**

Crear `src/infra/contexto-novedades.ts`, copiando el patrón exacto de `src/infra/contexto-finanzas.ts` pero con `repositorioNovedadesPrisma` y `ContextoNovedades`.

Crear `src/domains/novedades/consultas.ts`:

```ts
import { unstable_cache } from "next/cache";
import { paraCache, desdeCache } from "@/domains/finanzas/consultas";
import { repositorioNovedadesPrisma } from "@/infra/repositorios/novedades";
import type { Novedad } from "./tipos";

/**
 * paraCache y desdeCache son obligatorios: unstable_cache guarda con
 * JSON.stringify a secas y devolvería `creadoEn` como texto en un acierto de
 * caché, y la pantalla la formatea como fecha.
 */
export const novedadesDelCaso = unstable_cache(
  async (casoId: string) => paraCache(await repositorioNovedadesPrisma().delCaso(casoId)),
  ["novedades-del-caso"],
  { tags: ["novedades"] }
) as unknown as (casoId: string) => Promise<Novedad[]>;

export const novedadesDelAnimal = unstable_cache(
  async (animalId: string) => paraCache(await repositorioNovedadesPrisma().delAnimal(animalId)),
  ["novedades-del-animal"],
  { tags: ["novedades"] }
) as unknown as (animalId: string) => Promise<Novedad[]>;
```

Las páginas que las consumen aplican `desdeCache` al resultado, igual que hacen hoy las consultas de finanzas.

- [ ] **Paso 5: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/integracion/novedades-repositorio.test.ts`
Esperado: PASAN las 4.

- [ ] **Paso 6: Confirmar**

```bash
git add src/infra/repositorios/novedades.ts src/infra/contexto-novedades.ts src/domains/novedades/consultas.ts tests/integracion/novedades-repositorio.test.ts
git commit -m "feat: repositorio y consultas de novedades

La base guarda la foto desarmada en columnas y el dominio la ve como un
objeto: o están todos los campos, o no hay foto. Nunca a medias."
```

---

## Tarea 5: Dónde se ven las novedades

**Archivos:**
- Crear: `src/ui/novedades/ListaDeNovedades.tsx` y su módulo CSS
- Modificar: `src/app/ayudar/[slug]/Pestanas.tsx`, `src/app/ayudar/[slug]/page.tsx`, `src/app/adopcion/[slug]/page.tsx`
- Prueba: manual (paso 5)

**Interfaces:**
- Consume: `novedadesDelCaso`, `novedadesDelAnimal`, `urlDeFoto` de `@/domains/animales/fotos`.
- Produce: `<ListaDeNovedades novedades={...} />`, la cuarta pestaña.

- [ ] **Paso 1: El componente compartido**

Crear `src/ui/novedades/ListaDeNovedades.tsx`:

```tsx
import { urlDeFoto } from "@/domains/animales/fotos";
import type { Novedad } from "@/domains/novedades/tipos";
import estilos from "./ListaDeNovedades.module.css";

const FECHA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Se usa en la pestaña del caso y en la ficha del animal. Vive acá y no dentro
 * de una ruta porque las dos la muestran igual: una novedad no debería verse
 * distinta según desde dónde se la mire.
 */
export function ListaDeNovedades({ novedades, vacio }: { novedades: Novedad[]; vacio: string }) {
  if (novedades.length === 0) return <p className={estilos.vacio}>{vacio}</p>;

  return (
    <ol className={estilos.lista}>
      {novedades.map((novedad) => (
        <li key={novedad.id} className={estilos.novedad}>
          <time className={estilos.fecha} dateTime={novedad.creadoEn.toISOString()}>
            {FECHA.format(novedad.creadoEn)}
          </time>
          <h3 className={estilos.titulo}>{novedad.titulo}</h3>
          {novedad.cuerpo ? <p className={estilos.cuerpo}>{novedad.cuerpo}</p> : null}

          {novedad.foto ? (
            <figure className={estilos.figura}>
              {/* eslint-disable-next-line @next/next/no-img-element -- las medidas ya salen del pipeline de imágenes, no de Next */}
              <img
                src={urlDeFoto({ claveArchivo: novedad.foto.clave, ancho: novedad.foto.ancho }, 640)}
                alt={novedad.foto.alt}
                width={novedad.foto.ancho}
                height={novedad.foto.alto}
                loading="lazy"
              />
            </figure>
          ) : null}

          {novedad.documentoId ? (
            <a className={estilos.documento} href={`/documentos/${novedad.documentoId}`}>
              Ver el documento adjunto
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
```

Crear `ListaDeNovedades.module.css`: lista sin viñetas, `.fecha` en versalitas con `var(--ink-3)`, `.titulo` con la tipografía de título de tarjeta, y `.figura` con la imagen a ancho completo y radio `var(--radius-xs)`.

- [ ] **Paso 2: La cuarta pestaña**

En `src/app/ayudar/[slug]/Pestanas.tsx`, agregar la pestaña al arreglo:

```tsx
const PESTANAS = [
  { id: "resumen", etiqueta: "Resumen" },
  { id: "gastos", etiqueta: "Gastos" },
  { id: "libro", etiqueta: "Libro contable" },
  { id: "novedades", etiqueta: "Novedades" },
] as const;
```

Sumar `novedades: Novedad[]` a las propiedades del componente y su panel:

```tsx
{activa === "novedades" && (
  <div role="tabpanel" id="panel-novedades" aria-labelledby="pestana-novedades" className={estilos.panel}>
    <h2>Qué pasó con {nombreCorto}</h2>
    <ListaDeNovedades
      novedades={novedades}
      vacio="Todavía no hay novedades de este caso. Cuando la asociación publique una, aparece acá."
    />
  </div>
)}
```

En `src/app/ayudar/[slug]/page.tsx`, traer las novedades con `novedadesDelCaso(caso.id)`, aplicarles `desdeCache`, y pasárselas a `<Pestanas>`.

- [ ] **Paso 3: Las novedades en la ficha del animal**

En `src/app/adopcion/[slug]/page.tsx`, agregar una sección al final con `novedadesDelAnimal(animal.id)`:

```tsx
{novedades.length > 0 && (
  <section aria-labelledby="novedades-del-animal">
    <h2 id="novedades-del-animal">Cómo sigue {animal.nombre}</h2>
    <ListaDeNovedades novedades={novedades} vacio="" />
  </section>
)}
```

Aparece **también cuando el animal está adoptado**: el enlace que circuló por Facebook cuando buscaba familia sigue funcionando, y ahora además cuenta cómo le fue. Es lo que convierte una ficha vieja en una historia.

- [ ] **Paso 4: Revalidación**

Las acciones del panel que crean, editan o archivan una novedad tienen que llamar a `revalidateTag("novedades")`. Sin eso, la novedad recién publicada no aparece hasta que la caché expire.

- [ ] **Paso 5: Verificación manual**

1. Crear a mano en la base una novedad colgada de un caso y otra de un animal.
2. Entrar al caso: aparece la cuarta pestaña y la novedad adentro.
3. Entrar a la ficha del animal: aparece la sección con su novedad.
4. Marcar el animal como adoptado: la sección **sigue apareciendo**.
5. Archivar una novedad en la base: desaparece de la pantalla pública.

- [ ] **Paso 6: Confirmar**

```bash
git add src/ui/novedades "src/app/ayudar" "src/app/adopcion"
git commit -m "feat: cuarta pestaña del caso y novedades en la ficha del animal

Cierra el desvío anotado en el plan de la entrega 2. En la ficha aparecen
también cuando el animal ya fue adoptado: el enlace viejo de Facebook
ahora cuenta cómo le fue."
```

---

## Tarea 6: Panel para escribir novedades

**Archivos:**
- Crear: `src/app/panel/(protegido)/novedades/page.tsx`, `novedades/acciones.ts`, `novedades/Formulario.tsx`
- Prueba: manual (paso 4)

**Interfaces:**
- Consume: `crearNovedad`, `editarNovedad`, `archivarNovedad`, `procesarImagen`, `almacen`, `validarImagen`.
- Produce: acciones `accionCrearNovedad`, `accionEditarNovedad`, `accionArchivarNovedad`.

- [ ] **Paso 1: Las acciones**

Crear `src/app/panel/(protegido)/novedades/acciones.ts`:

```ts
"use server";

import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { auth } from "@/infra/auth";
import { prisma } from "@/infra/prisma";
import { repositorioNovedadesPrisma } from "@/infra/repositorios/novedades";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearNovedad, editarNovedad, archivarNovedad } from "@/domains/novedades/servicio";
import { almacen } from "@/infra/almacen";
import { exigirAlmacenPersistente } from "@/infra/almacen/configuracion";
import { validarImagen, TAMANO_MAXIMO_BYTES } from "@/infra/imagenes/validar";
import { procesarImagen } from "@/infra/imagenes/procesar";
import type { ContextoNovedades, Foto } from "@/domains/novedades/tipos";

async function conContextoNovedades<T>(fn: (ctx: ContextoNovedades) => Promise<T>): Promise<T> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  return prisma.$transaction(async (tx) =>
    fn({
      usuarioEmail: sesion.user.email!,
      rol: sesion.user.rol as ContextoNovedades["rol"],
      repositorio: repositorioNovedadesPrisma(tx),
      auditoria: auditoriaPrisma(tx),
    })
  );
}

/**
 * La imagen se procesa y se guarda ANTES de abrir la transacción: convertir y
 * subir tarda, y mantener una transacción de base abierta mientras tanto
 * bloquea filas sin necesidad.
 */
async function subirFotoSiHay(formulario: FormData): Promise<Foto | null> {
  const archivo = formulario.get("foto");
  if (!(archivo instanceof File) || archivo.size === 0) return null;

  const alt = String(formulario.get("fotoAlt") ?? "").trim();
  if (alt.length === 0) {
    throw new Error("Escribí una descripción de la foto: sin ella, quien no ve la imagen no sabe qué muestra");
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    throw new Error("La foto pesa más de 12 MB. Sacale peso antes de subirla.");
  }

  exigirAlmacenPersistente();
  const datos = Buffer.from(await archivo.arrayBuffer());
  await validarImagen(datos);
  const procesada = await procesarImagen(datos);

  const deposito = almacen();
  const clave = `novedades/${randomUUID()}`;
  for (const medida of procesada.medidas) {
    await deposito.guardar(`${clave}-${medida.ancho}.webp`, medida.datos, "image/webp");
  }

  return { clave, alt, ancho: procesada.ancho, alto: procesada.alto, placeholder: procesada.placeholder };
}

export async function accionCrearNovedad(formulario: FormData) {
  const foto = await subirFotoSiHay(formulario);

  await conContextoNovedades((ctx) =>
    crearNovedad(
      {
        casoId: (formulario.get("casoId") as string) || null,
        animalId: (formulario.get("animalId") as string) || null,
        titulo: String(formulario.get("titulo") ?? ""),
        cuerpo: String(formulario.get("cuerpo") ?? ""),
        foto,
        documentoId: (formulario.get("documentoId") as string) || null,
      },
      ctx
    )
  );

  revalidateTag("novedades");
}

export async function accionEditarNovedad(id: string, formulario: FormData) {
  await conContextoNovedades((ctx) =>
    editarNovedad(
      id,
      { titulo: String(formulario.get("titulo") ?? ""), cuerpo: String(formulario.get("cuerpo") ?? "") },
      ctx
    )
  );
  revalidateTag("novedades");
}

export async function accionArchivarNovedad(id: string) {
  await conContextoNovedades((ctx) => archivarNovedad(id, ctx));
  revalidateTag("novedades");
}
```

- [ ] **Paso 2: El formulario**

Crear `novedades/Formulario.tsx`: un selector de a qué cuelga —un caso o un animal, excluyentes—, título, cuerpo, foto opcional con su descripción obligatoria, y documento opcional.

**El selector tiene que ser excluyente en la pantalla**, no solo en el dominio: elegir un caso deshabilita la lista de animales y al revés. Si la pantalla permite elegir los dos, el error del dominio llega recién al enviar, y quien escribió trescientas palabras las pierde.

Usa el patrón de manejo de errores que ya tienen las otras pantallas del panel: `unstable_rethrow` y el toast, como en `animales/[id]/fotos.tsx`.

- [ ] **Paso 3: El listado**

Crear `novedades/page.tsx`: las novedades agrupadas por caso y por animal, con su fecha y autor, y los botones de editar y archivar. Las archivadas van al final, atenuadas.

Agregar el enlace a la navegación del panel para los roles que pueden escribirlas.

- [ ] **Paso 4: Verificación manual**

1. Publicar una novedad en un caso, sin foto → aparece en la cuarta pestaña.
2. Publicar una con foto → la imagen se ve, y en `almacenamiento/` están las cuatro medidas.
3. Intentar subir una foto sin descripción → la rechaza.
4. Intentar elegir un caso **y** un animal → la pantalla no lo permite.
5. Editar el título → cambia en público.
6. Archivar → desaparece de público y queda atenuada en el panel.
7. Entrar con un usuario de rol finanzas → no ve la sección de novedades, y si fuerza la acción, el dominio la rechaza.

- [ ] **Paso 5: Confirmar**

```bash
git add "src/app/panel/(protegido)/novedades"
git commit -m "feat: panel para escribir novedades

La imagen se procesa y se sube antes de abrir la transacción: convertir
y subir tarda, y no hay por qué tener filas bloqueadas mientras tanto."
```

---

# Mitad 4B — Notificaciones

## Tarea 7: Modelo de la cola

**Archivos:**
- Modificar: `prisma/schema.prisma`
- Crear: la migración generada
- Prueba: `tests/integracion/avisos-modelo.test.ts`

**Interfaces:**
- Consume: el esquema anterior.
- Produce: el modelo `AvisoPendiente` y el enum `TipoAviso`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/integracion/avisos-modelo.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const avisos: string[] = [];

afterAll(async () => {
  await prisma.avisoPendiente.deleteMany({ where: { id: { in: avisos } } });
  await prisma.$disconnect();
});

describe("modelo de la cola de avisos", () => {
  it("un aviso nace pendiente, sin intentos", async () => {
    const aviso = await prisma.avisoPendiente.create({
      data: { tipo: "POSTULACION_NUEVA", datos: { animalId: "animal-1", nombreAnimal: "Juanito" } },
    });
    avisos.push(aviso.id);

    expect(aviso.enviadoEn).toBeNull();
    expect(aviso.intentos).toBe(0);
    expect(aviso.ultimoError).toBeNull();
  });

  it("guarda quién originó la acción, para no avisarle a esa persona", async () => {
    const aviso = await prisma.avisoPendiente.create({
      data: { tipo: "TRANSFERENCIA_PENDIENTE", datos: {}, originadoPorEmail: "carla@huellas.org.ar" },
    });
    avisos.push(aviso.id);
    expect(aviso.originadoPorEmail).toBe("carla@huellas.org.ar");
  });

  it("se consultan los pendientes por el índice de enviadoEn", async () => {
    const pendiente = await prisma.avisoPendiente.create({ data: { tipo: "META_ALCANZADA", datos: {} } });
    const enviado = await prisma.avisoPendiente.create({
      data: { tipo: "META_ALCANZADA", datos: {}, enviadoEn: new Date() },
    });
    avisos.push(pendiente.id, enviado.id);

    const pendientes = await prisma.avisoPendiente.findMany({ where: { enviadoEn: null, id: { in: avisos } } });
    expect(pendientes.map((a) => a.id)).toContain(pendiente.id);
    expect(pendientes.map((a) => a.id)).not.toContain(enviado.id);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/integracion/avisos-modelo.test.ts`
Esperado: FALLA — `prisma.avisoPendiente` no existe.

- [ ] **Paso 3: Agregar el modelo**

En `prisma/schema.prisma`, copiar el bloque de la §4.1 de la especificación, con el modelo `AvisoPendiente` y el enum `TipoAviso`.

- [ ] **Paso 4: Generar y aplicar la migración**

```bash
npx prisma migrate dev --name entrega_4_avisos
```

- [ ] **Paso 5: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/integracion/avisos-modelo.test.ts`
Esperado: PASAN las 3.

- [ ] **Paso 6: Confirmar**

```bash
git add prisma tests/integracion/avisos-modelo.test.ts
git commit -m "feat: modelo de la cola de avisos"
```

---

## Tarea 8: El puerto de correo y sus dobles

**Archivos:**
- Crear: `src/domains/avisos/tipos.ts`, `src/infra/correo/consola.ts`, `src/infra/correo/index.ts`, `tests/dobles/proveedor-correo-falso.ts`
- Prueba: `tests/unidad/avisos-correo.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: `ProveedorDeCorreo`, `CorreoParaEnviar`, `correo()`, `proveedorCorreoFalso()`.

- [ ] **Paso 1: Definir el puerto**

Crear `src/domains/avisos/tipos.ts`:

```ts
import type { PuertoAuditoria } from "@/domains/animales/tipos";

export type TipoAviso = "POSTULACION_NUEVA" | "TRANSFERENCIA_PENDIENTE" | "DONACION_VERIFICADA" | "META_ALCANZADA";

export type Rol = "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";

export interface AvisoPendiente {
  id: string;
  tipo: TipoAviso;
  /** El hecho, no el correo redactado. Ver §4.2 de la especificación. */
  datos: Record<string, unknown>;
  originadoPorEmail: string | null;
  creadoEn: Date;
  enviadoEn: Date | null;
  intentos: number;
  ultimoError: string | null;
}

export interface CorreoParaEnviar {
  para: string[];
  asunto: string;
  cuerpo: string;
}

/** El dominio habla con este puerto. Nunca con Resend. */
export interface ProveedorDeCorreo {
  readonly nombre: string;
  enviar(correo: CorreoParaEnviar): Promise<void>;
}

export interface NuevoAviso {
  tipo: TipoAviso;
  datos: Record<string, unknown>;
  originadoPorEmail?: string | null;
}

/**
 * Lo que el dominio usa para anotar un aviso. Es solo una escritura en la
 * base, igual que la auditoría, así que va dentro de la transacción sin
 * problema: lo que nunca va adentro es el envío del correo.
 */
export interface PuertoAvisos {
  anotar(aviso: NuevoAviso): Promise<void>;
}

export interface RepositorioAvisos {
  anotar(aviso: NuevoAviso): Promise<void>;
  /** Los que faltan enviar y todavía no agotaron los intentos. */
  pendientes(limite: number, maxIntentos: number): Promise<AvisoPendiente[]>;
  marcarEnviados(ids: string[], cuando: Date): Promise<void>;
  registrarFallo(ids: string[], error: string): Promise<void>;
  /** Correos de los usuarios activos con alguno de esos roles. */
  correosDeRoles(roles: Rol[]): Promise<string[]>;
}

export interface ContextoAvisos {
  repositorio: RepositorioAvisos;
  correo: ProveedorDeCorreo;
  auditoria: PuertoAuditoria;
}
```

- [ ] **Paso 2: Escribir la prueba del proveedor de consola**

Crear `tests/unidad/avisos-correo.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { correoConsola } from "@/infra/correo/consola";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("proveedor de consola", () => {
  it("escribe el correo en la salida estándar en vez de mandarlo", async () => {
    const registro = vi.spyOn(console, "info").mockImplementation(() => {});
    await correoConsola().enviar({ para: ["marina@huellas.org.ar"], asunto: "Llegó una postulación", cuerpo: "Juanito" });

    const escrito = registro.mock.calls.flat().join(" ");
    expect(escrito).toContain("marina@huellas.org.ar");
    expect(escrito).toContain("Llegó una postulación");
  });

  it("se identifica por su nombre, para que el panel pueda decir cuál está activo", () => {
    expect(correoConsola().nombre).toBe("consola");
  });
});
```

- [ ] **Paso 3: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/avisos-correo.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 4: Implementar el proveedor de consola y la elección**

Crear `src/infra/correo/consola.ts`:

```ts
import type { CorreoParaEnviar, ProveedorDeCorreo } from "@/domains/avisos/tipos";

/**
 * En desarrollo los correos se escriben en la consola. Permite trabajar el
 * flujo entero —anotar, agrupar, vaciar la cola— sin mandar un solo correo de
 * verdad ni necesitar una cuenta.
 */
export function correoConsola(): ProveedorDeCorreo {
  return {
    nombre: "consola",
    async enviar(correo: CorreoParaEnviar) {
      console.info(
        `\n--- CORREO (no se envió: proveedor de consola) ---\n` +
          `Para: ${correo.para.join(", ")}\n` +
          `Asunto: ${correo.asunto}\n\n${correo.cuerpo}\n--- fin ---\n`
      );
    },
  };
}
```

Crear `src/infra/correo/index.ts`:

```ts
import type { ProveedorDeCorreo } from "@/domains/avisos/tipos";
import { correoConsola } from "./consola";
import { correoResend } from "./resend";

export function hayCorreoConfigurado(): boolean {
  return (process.env.RESEND_API_KEY ?? "").trim().length > 0 && (process.env.CORREO_REMITENTE ?? "").trim().length > 0;
}

/**
 * Único punto donde se elige el proveedor. Sin configuración usa la consola,
 * que es lo correcto en desarrollo: el flujo se prueba entero sin mandar nada.
 */
export function correo(): ProveedorDeCorreo {
  return hayCorreoConfigurado() ? correoResend() : correoConsola();
}
```

Crear `tests/dobles/proveedor-correo-falso.ts`:

```ts
import type { CorreoParaEnviar, ProveedorDeCorreo } from "@/domains/avisos/tipos";

export function proveedorCorreoFalso({ falla = false }: { falla?: boolean } = {}) {
  const enviados: CorreoParaEnviar[] = [];

  const proveedor: ProveedorDeCorreo = {
    nombre: "falso",
    async enviar(correo) {
      if (falla) throw new Error("el proveedor de correo no responde");
      enviados.push(correo);
    },
  };

  return Object.assign(proveedor, { enviados });
}
```

`src/infra/correo/resend.ts` se crea en la tarea 11. Hasta entonces, para que compile, dejarlo con la implementación mínima que la tarea 11 completa:

```ts
import type { ProveedorDeCorreo } from "@/domains/avisos/tipos";

export function correoResend(): ProveedorDeCorreo {
  throw new Error("El adaptador de Resend se implementa en la tarea 11");
}
```

- [ ] **Paso 5: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/avisos-correo.test.ts`
Esperado: PASAN las 2.

- [ ] **Paso 6: Confirmar**

```bash
git add src/domains/avisos/tipos.ts src/infra/correo tests/dobles/proveedor-correo-falso.ts tests/unidad/avisos-correo.test.ts
git commit -m "feat: puerto de correo con proveedor de consola

En desarrollo los correos se escriben en la consola: el flujo entero se
prueba sin mandar nada ni necesitar una cuenta."
```

---

## Tarea 9: Redactar los avisos

**Archivos:**
- Crear: `src/domains/avisos/redaccion.ts`
- Prueba: `tests/unidad/avisos-redaccion.test.ts`

**Interfaces:**
- Consume: `AvisoPendiente`, `TipoAviso`.
- Produce: `rolesQueReciben(tipo)`, `redactar(avisos, urlBase): { asunto: string; cuerpo: string }`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/avisos-redaccion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rolesQueReciben, redactar } from "@/domains/avisos/redaccion";
import type { AvisoPendiente } from "@/domains/avisos/tipos";

const aviso = (id: string, tipo: AvisoPendiente["tipo"], datos: Record<string, unknown>): AvisoPendiente => ({
  id,
  tipo,
  datos,
  originadoPorEmail: null,
  creadoEn: new Date("2026-09-15T10:00:00Z"),
  enviadoEn: null,
  intentos: 0,
  ultimoError: null,
});

describe("rolesQueReciben", () => {
  it("una postulación va a quien gestiona animales", () => {
    expect(rolesQueReciben("POSTULACION_NUEVA").sort()).toEqual(["ADMINISTRACION", "ANIMALES"]);
  });

  it("lo del dinero va a finanzas", () => {
    expect(rolesQueReciben("TRANSFERENCIA_PENDIENTE").sort()).toEqual(["ADMINISTRACION", "FINANZAS"]);
    expect(rolesQueReciben("DONACION_VERIFICADA").sort()).toEqual(["ADMINISTRACION", "FINANZAS"]);
    expect(rolesQueReciben("META_ALCANZADA").sort()).toEqual(["ADMINISTRACION", "FINANZAS"]);
  });

  it("redacción no recibe avisos: no gestiona ni animales ni plata", () => {
    for (const tipo of ["POSTULACION_NUEVA", "TRANSFERENCIA_PENDIENTE", "DONACION_VERIFICADA", "META_ALCANZADA"] as const) {
      expect(rolesQueReciben(tipo)).not.toContain("REDACCION");
    }
  });
});

describe("redactar", () => {
  const urlBase = "https://refugiohuellas.org.ar";

  it("un solo aviso: el asunto dice qué pasó", () => {
    const { asunto } = redactar([aviso("a", "POSTULACION_NUEVA", { nombreAnimal: "Juanito" })], urlBase);
    expect(asunto).toContain("Juanito");
    expect(asunto.toLowerCase()).toContain("postulación");
  });

  it("varios avisos: el asunto dice cuántos hay", () => {
    const { asunto } = redactar(
      [
        aviso("a", "POSTULACION_NUEVA", { nombreAnimal: "Juanito" }),
        aviso("b", "POSTULACION_NUEVA", { nombreAnimal: "Luna" }),
        aviso("c", "META_ALCANZADA", { tituloCaso: "Luna — cirugía" }),
      ],
      urlBase
    );
    expect(asunto).toContain("3");
  });

  it("el cuerpo lleva un enlace al panel por cada cosa que pasó", () => {
    const { cuerpo } = redactar(
      [
        aviso("a", "POSTULACION_NUEVA", { nombreAnimal: "Juanito", postulacionId: "post-1" }),
        aviso("b", "TRANSFERENCIA_PENDIENTE", { tituloCaso: "Luna — cirugía", montoTexto: "$10.000" }),
      ],
      urlBase
    );
    expect(cuerpo).toContain(`${urlBase}/panel/postulaciones/post-1`);
    expect(cuerpo).toContain(`${urlBase}/panel/finanzas/transferencias`);
  });

  it("una donación verificada dice el monto y el caso", () => {
    const { cuerpo } = redactar(
      [aviso("a", "DONACION_VERIFICADA", { tituloCaso: "Luna — cirugía", montoTexto: "$25.000" })],
      urlBase
    );
    expect(cuerpo).toContain("$25.000");
    expect(cuerpo).toContain("Luna — cirugía");
  });

  it("es texto plano, sin etiquetas HTML", () => {
    const { cuerpo } = redactar([aviso("a", "META_ALCANZADA", { tituloCaso: "Luna — cirugía" })], urlBase);
    expect(cuerpo).not.toMatch(/<[a-z]/i);
  });

  it("un tipo con datos incompletos no rompe el correo entero", () => {
    // Si un aviso viejo quedó sin un dato, el resto tiene que salir igual.
    const { cuerpo } = redactar(
      [aviso("a", "POSTULACION_NUEVA", {}), aviso("b", "META_ALCANZADA", { tituloCaso: "Luna — cirugía" })],
      urlBase
    );
    expect(cuerpo).toContain("Luna — cirugía");
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/avisos-redaccion.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/avisos/redaccion.ts`:

```ts
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
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/avisos-redaccion.test.ts`
Esperado: PASAN las 9.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/avisos/redaccion.ts tests/unidad/avisos-redaccion.test.ts
git commit -m "feat: redacción de los avisos en texto plano

Un enlace al panel por cada cosa que pasó. Si a un aviso le falta un
dato, sale con un texto genérico en vez de romper el correo entero."
```

---

## Tarea 10: Vaciar la cola

Esta es la tarea central de la mitad 4B.

**Archivos:**
- Crear: `src/domains/avisos/cola.ts`
- Prueba: `tests/unidad/avisos-cola.test.ts`
- Crear: `tests/dobles/repositorio-avisos-memoria.ts`

**Interfaces:**
- Consume: `RepositorioAvisos`, `ProveedorDeCorreo`, `rolesQueReciben`, `redactar`.
- Produce: `vaciarCola(ctx, urlBase): Promise<ResumenDelVaciado>`, `MAX_INTENTOS`, `TOPE_POR_CORRIDA`.

- [ ] **Paso 1: Crear el doble en memoria**

Crear `tests/dobles/repositorio-avisos-memoria.ts`:

```ts
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
```

- [ ] **Paso 2: Escribir la prueba que falla**

Crear `tests/unidad/avisos-cola.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { vaciarCola, MAX_INTENTOS } from "@/domains/avisos/cola";
import { repositorioAvisosEnMemoria } from "../dobles/repositorio-avisos-memoria";
import { proveedorCorreoFalso } from "../dobles/proveedor-correo-falso";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

const URL_BASE = "https://refugiohuellas.org.ar";

function escenario(correosPorRol = { ANIMALES: ["marina@huellas.org.ar"], FINANZAS: ["carla@huellas.org.ar"], ADMINISTRACION: ["admin@huellas.org.ar"] }) {
  const repositorio = repositorioAvisosEnMemoria(correosPorRol);
  const correo = proveedorCorreoFalso();
  const auditoria = auditoriaEnMemoria();
  return { repositorio, correo, auditoria, ctx: { repositorio, correo, auditoria } };
}

describe("vaciarCola", () => {
  it("sin pendientes no manda nada", async () => {
    const e = escenario();
    const resumen = await vaciarCola(e.ctx, URL_BASE);
    expect(resumen.enviados).toBe(0);
    expect(e.correo.enviados).toHaveLength(0);
  });

  it("manda un correo a cada destinatario que corresponde", async () => {
    const e = escenario();
    await e.repositorio.anotar({ tipo: "POSTULACION_NUEVA", datos: { nombreAnimal: "Juanito" } });

    await vaciarCola(e.ctx, URL_BASE);

    // Animales y administración, no finanzas.
    const destinatarios = e.correo.enviados.flatMap((c) => c.para).sort();
    expect(destinatarios).toEqual(["admin@huellas.org.ar", "marina@huellas.org.ar"]);
  });

  it("agrupa: veinte donaciones son un correo por persona, no veinte", async () => {
    const e = escenario();
    for (let i = 0; i < 20; i++) {
      await e.repositorio.anotar({ tipo: "DONACION_VERIFICADA", datos: { tituloCaso: "Luna — cirugía", montoTexto: "$1.000" } });
    }

    await vaciarCola(e.ctx, URL_BASE);

    // Dos personas reciben finanzas: carla y admin. Un correo cada una.
    expect(e.correo.enviados).toHaveLength(2);
    expect(e.correo.enviados[0].asunto).toContain("20");
  });

  it("no le avisa a quien hizo la acción", async () => {
    const e = escenario();
    await e.repositorio.anotar({
      tipo: "TRANSFERENCIA_PENDIENTE",
      datos: { tituloCaso: "Luna — cirugía" },
      originadoPorEmail: "carla@huellas.org.ar",
    });

    await vaciarCola(e.ctx, URL_BASE);

    const destinatarios = e.correo.enviados.flatMap((c) => c.para);
    expect(destinatarios).not.toContain("carla@huellas.org.ar");
    expect(destinatarios).toContain("admin@huellas.org.ar");
  });

  it("marca los enviados: vaciar dos veces no manda dos veces", async () => {
    const e = escenario();
    await e.repositorio.anotar({ tipo: "POSTULACION_NUEVA", datos: { nombreAnimal: "Juanito" } });

    await vaciarCola(e.ctx, URL_BASE);
    const despuesDeLaPrimera = e.correo.enviados.length;
    await vaciarCola(e.ctx, URL_BASE);

    expect(e.correo.enviados).toHaveLength(despuesDeLaPrimera);
  });

  it("si el envío falla, el aviso sigue pendiente y suma un intento", async () => {
    const repositorio = repositorioAvisosEnMemoria({ ANIMALES: ["marina@huellas.org.ar"] });
    const correo = proveedorCorreoFalso({ falla: true });
    const ctx = { repositorio, correo, auditoria: auditoriaEnMemoria() };
    await repositorio.anotar({ tipo: "POSTULACION_NUEVA", datos: { nombreAnimal: "Juanito" } });

    const resumen = await vaciarCola(ctx, URL_BASE);

    expect(resumen.fallidos).toBe(1);
    expect(repositorio.avisos[0].enviadoEn).toBeNull();
    expect(repositorio.avisos[0].intentos).toBe(1);
    expect(repositorio.avisos[0].ultimoError).toContain("no responde");
  });

  it("después de agotar los intentos deja de tomarlo", async () => {
    const repositorio = repositorioAvisosEnMemoria({ ANIMALES: ["marina@huellas.org.ar"] });
    const correo = proveedorCorreoFalso({ falla: true });
    const ctx = { repositorio, correo, auditoria: auditoriaEnMemoria() };
    await repositorio.anotar({ tipo: "POSTULACION_NUEVA", datos: { nombreAnimal: "Juanito" } });

    for (let i = 0; i < MAX_INTENTOS + 2; i++) await vaciarCola(ctx, URL_BASE);

    expect(repositorio.avisos[0].intentos).toBe(MAX_INTENTOS);
  });

  it("un aviso sin destinatarios se marca enviado y no queda trabado", async () => {
    // Nadie tiene el rol que recibe: si no se marcara, se reintentaría para siempre.
    const e = escenario({ FINANZAS: [], ADMINISTRACION: [] });
    await e.repositorio.anotar({ tipo: "DONACION_VERIFICADA", datos: { tituloCaso: "Luna" } });

    await vaciarCola(e.ctx, URL_BASE);

    expect(e.repositorio.avisos[0].enviadoEn).not.toBeNull();
    expect(e.correo.enviados).toHaveLength(0);
  });
});
```

- [ ] **Paso 3: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/avisos-cola.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 4: Implementar**

Crear `src/domains/avisos/cola.ts`:

```ts
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
```

- [ ] **Paso 5: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/avisos-cola.test.ts`
Esperado: PASAN las 8.

- [ ] **Paso 6: Confirmar**

```bash
git add src/domains/avisos/cola.ts tests/unidad/avisos-cola.test.ts tests/dobles/repositorio-avisos-memoria.ts
git commit -m "feat: vaciado de la cola de avisos, con agrupado y reintentos

Agrupar no es una optimización: veinte correos por veinte donaciones
consiguen que alguien apague las notificaciones en una semana."
```

---

## Tarea 11: Anotar los avisos desde el dominio

**Archivos:**
- Crear: `src/infra/repositorios/avisos.ts`
- Modificar: `src/domains/finanzas/tipos.ts`, `src/domains/postulaciones/tipos.ts` (sumar `avisos` al contexto)
- Modificar: `src/domains/finanzas/asientos.ts`, `src/domains/finanzas/donaciones.ts`, `src/domains/postulaciones/envio.ts`, `src/domains/pagos/procesar-aviso.ts`
- Prueba: `tests/unidad/avisos-disparadores.test.ts`

**Interfaces:**
- Consume: `PuertoAvisos`.
- Produce: `repositorioAvisosPrisma(cliente?)`; los contextos de finanzas y postulaciones ganan el campo `avisos`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/avisos-disparadores.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { crearCaso } from "@/domains/finanzas/casos";
import { registrarAsiento, registrarGasto } from "@/domains/finanzas/asientos";
import { declararTransferencia, verificarTransferencia } from "@/domains/finanzas/donaciones";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { repositorioAvisosEnMemoria } from "../dobles/repositorio-avisos-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import { puertoAvisos } from "@/domains/avisos/cola";

const base = {
  titulo: "Luna — cirugía",
  situacion: "La atropellaron en Provincias Unidas y necesita cirugía de cadera.",
  metaCentavos: 50000000n,
};

function escenario() {
  const repositorioDeAvisos = repositorioAvisosEnMemoria();
  const ctx = {
    usuarioEmail: "carla@huellas.org.ar",
    rol: "FINANZAS" as const,
    repositorio: repositorioFinanzasEnMemoria(),
    auditoria: auditoriaEnMemoria(),
    avisos: puertoAvisos(repositorioDeAvisos),
  };
  return { ctx, repositorioDeAvisos };
}

describe("qué anota un aviso y qué no", () => {
  it("alcanzar la meta anota un aviso", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    await registrarAsiento(
      { casoId: caso.id, tipo: "DONACION", centavos: 62000000n, descripcion: "Grande", fechaEfectiva: new Date() },
      e.ctx
    );

    const tipos = e.repositorioDeAvisos.avisos.map((a) => a.tipo);
    expect(tipos).toContain("META_ALCANZADA");
  });

  it("no vuelve a anotarlo si ya estaba en meta alcanzada", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 62000000n, descripcion: "A", fechaEfectiva: new Date() }, e.ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000000n, descripcion: "B", fechaEfectiva: new Date() }, e.ctx);

    const alcanzadas = e.repositorioDeAvisos.avisos.filter((a) => a.tipo === "META_ALCANZADA");
    expect(alcanzadas).toHaveLength(1);
  });

  it("declarar una transferencia anota un aviso", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    await declararTransferencia(
      { casoId: caso.id, centavos: 1000000n, nombreDonante: null, publicarNombre: false, comprobanteId: null },
      e.ctx.repositorio,
      e.ctx.avisos
    );

    expect(e.repositorioDeAvisos.avisos.map((a) => a.tipo)).toContain("TRANSFERENCIA_PENDIENTE");
  });

  // El criterio de la §5.2: lo que hace una persona del equipo no avisa.
  it("registrar un gasto NO anota ningún aviso", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    await registrarGasto(
      { casoId: caso.id, centavos: 100000n, descripcion: "Estudios", documentoId: null, fechaEfectiva: new Date() },
      e.ctx
    );

    expect(e.repositorioDeAvisos.avisos).toHaveLength(0);
  });

  it("verificar una transferencia NO anota DONACION_VERIFICADA", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    const intencion = await declararTransferencia(
      { casoId: caso.id, centavos: 1000000n, nombreDonante: null, publicarNombre: false, comprobanteId: null },
      e.ctx.repositorio,
      e.ctx.avisos
    );

    await verificarTransferencia(intencion.id, e.ctx);

    // La declaró de afuera: eso sí avisó. Verificarla la hizo Carla, que ya sabe.
    const tipos = e.repositorioDeAvisos.avisos.map((a) => a.tipo);
    expect(tipos).toContain("TRANSFERENCIA_PENDIENTE");
    expect(tipos).not.toContain("DONACION_VERIFICADA");
  });

  it("el aviso guarda quién originó la acción", async () => {
    const e = escenario();
    const caso = await crearCaso(base, e.ctx);
    await registrarAsiento(
      { casoId: caso.id, tipo: "DONACION", centavos: 62000000n, descripcion: "Grande", fechaEfectiva: new Date() },
      e.ctx
    );

    const aviso = e.repositorioDeAvisos.avisos.find((a) => a.tipo === "META_ALCANZADA")!;
    expect(aviso.originadoPorEmail).toBe("carla@huellas.org.ar");
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/avisos-disparadores.test.ts`
Esperado: FALLA — los contextos no tienen `avisos`.

- [ ] **Paso 3: Sumar el puerto a los contextos**

En `src/domains/finanzas/tipos.ts` y `src/domains/postulaciones/tipos.ts`, agregar al contexto:

```ts
import type { PuertoAvisos } from "@/domains/avisos/tipos";

export interface ContextoFinanzas {
  // ... campos existentes
  avisos: PuertoAvisos;
}
```

**Es obligatorio, no opcional.** Un campo opcional que, cuando falta, no anota nada, produce un sistema que deja de avisar sin que nadie se entere. Haciéndolo obligatorio, TypeScript enumera cada lugar que hay que actualizar: `contexto-finanzas.ts`, `contexto-postulaciones.ts`, las acciones del panel, la ruta del webhook y los dobles de prueba.

Ejecutar `npx tsc --noEmit` para obtener esa lista y recorrerla.

- [ ] **Paso 4: Anotar en cada disparador**

En `src/domains/finanzas/asientos.ts`, dentro de `registrarAsiento`, después de actualizar el caso:

```ts
const estadoNuevo = estadoSegunSaldo(caso.estado, saldo.recibidoCentavos, caso.metaCentavos);

// Solo en la transición: si ya estaba en meta alcanzada, no se vuelve a avisar
// con cada donación posterior.
if (estadoNuevo === "META_ALCANZADA" && caso.estado !== "META_ALCANZADA") {
  await ctx.avisos.anotar({
    tipo: "META_ALCANZADA",
    datos: { casoId: caso.id, tituloCaso: caso.titulo },
    originadoPorEmail: entrada.creadoPorSistema ? null : ctx.usuarioEmail,
  });
}
```

`EntradaAsiento` ya tiene el campo `creadoPorSistema` (lo usa el webhook), así que el cálculo de `originadoPorEmail` de arriba funciona sin cambiar la entrada.

En `src/domains/finanzas/donaciones.ts`, `declararTransferencia` no exige sesión, así que no tiene contexto: hoy su firma es `(entrada, repositorio)`. Pasa a ser `(entrada, repositorio, avisos: PuertoAvisos)` y anota `TRANSFERENCIA_PENDIENTE` con `originadoPorEmail: null` —la declara alguien de afuera— y los datos `{ casoId, tituloCaso, montoTexto: formatearCentavos(entrada.centavos) }`.

En `src/domains/postulaciones/envio.ts`, hoy la firma es `enviarPostulacion(entrada, repositorio, auditoria)`. Pasa a ser `(entrada, repositorio, auditoria, avisos: PuertoAvisos)` y anota `POSTULACION_NUEVA` con los datos `{ postulacionId, animalId, nombreAnimal }`. **Solo cuando `repetida` es `false`**: si se devolvió la postulación existente, no se anota un aviso nuevo.

En `src/domains/pagos/procesar-aviso.ts`, `ContextoAviso` (el del webhook de Mercado Pago) gana el campo obligatorio `avisos: PuertoAvisos`, y hay que **pasarlo también al contexto que ese archivo le arma a `registrarAsiento`** (el que tiene `usuarioEmail: "sistema"`): si no, una donación por Mercado Pago que completa la meta no anotaría `META_ALCANZADA`. Cuando el resultado es `asentado`, anota además `DONACION_VERIFICADA` con `originadoPorEmail: null` —vino del webhook, no la hizo nadie del equipo— y los datos `{ casoId, tituloCaso, montoTexto }`.

Las rutas y acciones que llaman a estas funciones (`src/app/api/pagos/…`, la acción pública de transferencia, la de postulación) construyen el puerto con `puertoAvisos(repositorioAvisosPrisma(tx))`, **con el mismo `tx` de la transacción**: así el aviso se anota o se descarta junto con la acción.

- [ ] **Paso 5: Implementar el repositorio Prisma de avisos**

Crear `src/infra/repositorios/avisos.ts`:

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import type { AvisoPendiente, RepositorioAvisos, Rol } from "@/domains/avisos/tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

export function repositorioAvisosPrisma(cliente: ClienteBase = clientePorDefecto): RepositorioAvisos {
  return {
    async anotar(aviso) {
      await cliente.avisoPendiente.create({
        data: {
          tipo: aviso.tipo,
          datos: aviso.datos as never,
          originadoPorEmail: aviso.originadoPorEmail ?? null,
        },
      });
    },
    async pendientes(limite, maxIntentos) {
      return (await cliente.avisoPendiente.findMany({
        where: { enviadoEn: null, intentos: { lt: maxIntentos } },
        orderBy: { creadoEn: "asc" },
        take: limite,
      })) as unknown as AvisoPendiente[];
    },
    async marcarEnviados(ids, cuando) {
      await cliente.avisoPendiente.updateMany({ where: { id: { in: ids } }, data: { enviadoEn: cuando } });
    },
    async registrarFallo(ids, error) {
      await cliente.avisoPendiente.updateMany({
        where: { id: { in: ids } },
        data: { intentos: { increment: 1 }, ultimoError: error.slice(0, 500) },
      });
    },
    async correosDeRoles(roles: Rol[]) {
      const usuarios = await cliente.usuario.findMany({
        where: { activo: true, rol: { in: roles as never } },
        select: { email: true },
      });
      return usuarios.map((u) => u.email);
    },
  };
}
```

- [ ] **Paso 6: Ejecutar y verificar que pasa**

Ejecutar: `npm test`
Esperado: PASA todo. Las pruebas de las entregas anteriores van a necesitar el campo `avisos` en sus contextos: agregarlo con `puertoAvisos(repositorioAvisosEnMemoria())`.

Si hubo que arreglar algo de una entrega anterior para que compile, **va en un commit aparte**.

- [ ] **Paso 7: Confirmar**

```bash
git add src/domains src/infra tests
git commit -m "feat: los disparadores anotan avisos en la cola

El puerto es obligatorio en el contexto, no opcional: uno opcional que
cuando falta no anota nada produce un sistema que deja de avisar sin que
nadie se entere."
```

---

## Tarea 12: Adaptador de Resend, ruta de vaciado e invariantes

**Archivos:**
- Modificar: `src/infra/correo/resend.ts`
- Crear: `src/app/api/tareas/avisos/route.ts`, `scripts/vaciar-avisos.ts`, `tests/unidad/avisos-invariantes.test.ts`
- Modificar: `.env.example`, `package.json`, `docs/operacion.md`

**Interfaces:**
- Consume: todo lo anterior.
- Produce: `correoResend()`, la ruta `POST /api/tareas/avisos`, `npm run avisos`.

- [ ] **Paso 1: Instalar el SDK**

```bash
npm install resend
```

- [ ] **Paso 2: Implementar el adaptador**

Reemplazar `src/infra/correo/resend.ts`:

```ts
import { Resend } from "resend";
import type { CorreoParaEnviar, ProveedorDeCorreo } from "@/domains/avisos/tipos";

export function correoResend(): ProveedorDeCorreo {
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;
  if (!clave || !remitente) throw new Error("Faltan RESEND_API_KEY o CORREO_REMITENTE");

  const cliente = new Resend(clave);

  return {
    nombre: "resend",
    async enviar(correo: CorreoParaEnviar) {
      const { error } = await cliente.emails.send({
        from: remitente,
        to: correo.para,
        subject: correo.asunto,
        text: correo.cuerpo,
      });

      // Resend devuelve el error en la respuesta en vez de lanzarlo. Si no se
      // revisa, un envío fallido pasa por exitoso y el aviso se marca enviado.
      if (error) throw new Error(`Resend rechazó el envío: ${error.message}`);
    },
  };
}
```

- [ ] **Paso 3: La ruta de vaciado**

Crear `src/app/api/tareas/avisos/route.ts`:

```ts
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { vaciarCola } from "@/domains/avisos/cola";
import { repositorioAvisosPrisma } from "@/infra/repositorios/avisos";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { correo } from "@/infra/correo";

export const runtime = "nodejs";

function secretoValido(recibido: string | null): boolean {
  const esperado = process.env.TAREAS_SECRETO ?? "";
  if (!esperado || !recibido) return false;

  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(recibido, "utf8");
  if (a.length !== b.length) return false;
  // Comparación de tiempo constante, igual que la firma del webhook.
  return timingSafeEqual(a, b);
}

export async function POST(pedido: Request) {
  if (!secretoValido(pedido.headers.get("x-tareas-secreto"))) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const urlBase = process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000";
  const resumen = await vaciarCola(
    { repositorio: repositorioAvisosPrisma(), correo: correo(), auditoria: auditoriaPrisma() },
    urlBase
  );

  return NextResponse.json(resumen);
}
```

Crear `scripts/vaciar-avisos.ts`, que llama a `vaciarCola` directamente para usarlo en desarrollo sin levantar el servidor, y agregar a `package.json`:

```json
"avisos": "tsx scripts/vaciar-avisos.ts"
```

- [ ] **Paso 4: Documentar las variables**

Agregar a `.env.example`:

```
# Notificaciones por correo. Sin estas variables los correos se escriben en la
# consola en vez de enviarse, que es lo correcto en desarrollo.
RESEND_API_KEY=""
# Tiene que ser de un dominio verificado en Resend. Sin dominio verificado,
# Resend solo permite enviar a la dirección de la cuenta.
CORREO_REMITENTE="Huellas <avisos@refugiohuellas.org.ar>"
# Secreto que protege la ruta que vacía la cola de avisos.
TAREAS_SECRETO=""
```

Agregar a `docs/operacion.md` una sección con cómo crear la cuenta de Resend, verificar el dominio, y cómo programar la llamada a la ruta.

- [ ] **Paso 5: Escribir las invariantes**

Crear `tests/unidad/avisos-invariantes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function archivosDe(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => path.join(dir, f));
}

describe("invariantes de la entrega 4", () => {
  it("ningún dominio importa el proveedor de correo: solo el puerto", () => {
    const infractores = archivosDe("src/domains").filter((f) =>
      /from "@\/infra\/correo|from "resend"/.test(readFileSync(f, "utf8"))
    );
    expect(infractores, `el dominio no puede conocer al proveedor: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("ningún dominio manda un correo: solo anota avisos", () => {
    const infractores = archivosDe("src/domains").filter((f) => /\.enviar\(\s*\{[^}]*asunto/.test(readFileSync(f, "utf8")));
    expect(
      infractores,
      `mandar un correo desde el dominio lo pone dentro de la transacción: ${infractores.join(", ")}`
    ).toHaveLength(0);
  });

  it("la ruta de vaciado valida el secreto antes de tocar la cola", () => {
    const ruta = readFileSync("src/app/api/tareas/avisos/route.ts", "utf8");
    const posicionSecreto = ruta.indexOf("secretoValido");
    const posicionVaciado = ruta.indexOf("vaciarCola");
    expect(posicionSecreto).toBeGreaterThan(-1);
    expect(posicionSecreto, "el secreto se valida después de vaciar").toBeLessThan(posicionVaciado);
  });

  it("el adaptador de Resend revisa el error de la respuesta", () => {
    // Resend devuelve el error en la respuesta en vez de lanzarlo: si no se
    // revisa, un envío fallido pasa por exitoso y el aviso se da por entregado.
    const adaptador = readFileSync("src/infra/correo/resend.ts", "utf8");
    expect(adaptador).toMatch(/if\s*\(\s*error\s*\)/);
  });

  it("el puerto de avisos es obligatorio en los contextos, no opcional", () => {
    for (const archivo of [
      "src/domains/finanzas/tipos.ts",
      "src/domains/postulaciones/tipos.ts",
      "src/domains/pagos/procesar-aviso.ts",
    ]) {
      const contenido = readFileSync(archivo, "utf8");
      expect(contenido, `${archivo} no declara el puerto de avisos`).toMatch(/avisos:\s*PuertoAvisos/);
      expect(contenido, `${archivo} lo declara opcional: dejaría de avisar en silencio`).not.toMatch(
        /avisos\?:\s*PuertoAvisos/
      );
    }
  });

  it("las novedades no se borran: no hay ninguna llamada a delete", () => {
    const repositorio = readFileSync("src/infra/repositorios/novedades.ts", "utf8");
    expect(repositorio).not.toMatch(/novedad\.delete/);
  });
});
```

- [ ] **Paso 6: Ejecutar todo**

Ejecutar: `npx vitest run tests/unidad/avisos-invariantes.test.ts`
Esperado: PASAN las 6. Si alguna falla, **no se arregla la prueba**: se arregla el código.

Ejecutar: `npm test`
Esperado: PASA todo, incluidas las 270 pruebas anteriores.

- [ ] **Paso 7: Verificación manual de punta a punta**

Sin `RESEND_API_KEY`, o sea con el proveedor de consola:

1. Enviar una postulación desde el sitio público.
2. Consultar `SELECT tipo, "enviadoEn" FROM "AvisoPendiente"` → hay una fila pendiente.
3. Correr `npm run avisos` → el correo aparece en la consola, con el enlace al panel.
4. Correr `npm run avisos` otra vez → no vuelve a aparecer.
5. Llamar a `POST /api/tareas/avisos` sin el encabezado del secreto → responde 401.

- [ ] **Paso 8: Confirmar**

```bash
git add src tests scripts package.json package-lock.json .env.example docs
git commit -m "feat: adaptador de Resend, ruta de vaciado e invariantes

Resend devuelve el error en la respuesta en vez de lanzarlo: sin revisar
ese campo, un envío fallido pasaría por exitoso y el aviso se daría por
entregado."
```

---

## Cierre de la entrega

- [ ] **Paso 1: Suite completa y tipos**

```bash
npx tsc --noEmit
npm test
```

Esperado: sin errores de tipos y todas las pruebas en verde.

- [ ] **Paso 2: Actualizar el grafo**

```
/graphify . --update
```

Obligatorio antes de fusionar: el grafo tiene que conocer los dominios `novedades` y `avisos` para la próxima entrega.

- [ ] **Paso 3: Fusionar**

```bash
git checkout main
git merge --no-ff entrega-4-novedades-notificaciones
```

No se hace push ni se fusiona si el paso 2 no se corrió.

---

## Cobertura de la especificación

| Requisito de la spec | Tarea |
|---|---|
| §3.1 Modelo de novedades y relaciones inversas | 1 |
| §3.2 Sin borradores, exactamente un dueño, quién escribe | 3 |
| §3.3 Cuarta pestaña y ficha del animal | 5 |
| §4.1 Modelo de la cola | 7 |
| §4.2 Anotar en la transacción, sin destinatarios guardados | 10, 11 |
| §4.3 Vaciado, agrupado, tope, reintentos | 10, 12 |
| §5.1 Tabla de destinatarios | 9 |
| §5.2 Qué no avisa, y no avisar al autor | 10, 11 |
| §6.1 Puerto y dos implementaciones | 8, 12 |
| §6.2 Texto plano con enlaces | 9 |
| §6.3 Limitación de Resend | 12 |
| §7 Pruebas | 3, 10, 12 |

## Fuera de alcance

Correos hacia afuera, WhatsApp y push. El puerto los admite como otra implementación; no se construyen acá.
