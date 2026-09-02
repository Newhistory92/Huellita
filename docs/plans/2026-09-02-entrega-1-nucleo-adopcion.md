# Entrega 1 — Núcleo de adopción: Plan de implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Publicar animales en adopción con ficha permanente, filtros y panel propio, de modo que la asociación pueda dejar de depender de Facebook para las adopciones.

**Arquitectura:** Monolito modular en Next.js 15 (App Router) con tres capas: `app/` solo presentación, `domains/` las reglas de negocio, `infra/` las piezas reemplazables. Los dominios dependen de puertos (interfaces), no de Prisma, para que sus pruebas corran sin base de datos. Las páginas públicas se generan estáticamente y se revalidan por etiqueta cuando la asociación publica.

**Stack:** Next.js 15, React 19, TypeScript estricto, PostgreSQL + Prisma 6, Auth.js v5 (Google), sharp, zod, Vitest. CSS propio con variables (sin framework de estilos: el sistema de diseño ya es un sistema de tokens).

**Spec:** [docs/specs/2026-09-02-entrega-1-nucleo-adopcion-design.md](../specs/2026-09-02-entrega-1-nucleo-adopcion-design.md)
**Sistema de diseño:** [docs/specs/2026-09-02-sistema-diseno-v1.md](../specs/2026-09-02-sistema-diseno-v1.md)
**Prototipo de referencia:** [docs/prototipo/huellas-prototipo-v1.html](../prototipo/huellas-prototipo-v1.html)

## Restricciones globales

Estas reglas aplican a **todas** las tareas. Copiadas literalmente de las specs.

- **Las páginas y los componentes nunca acceden a la base de datos directamente.** Toda lectura y escritura pasa por una función de dominio (spec §3.1).
- **Los importes son enteros en centavos (`BigInt`), nunca decimales de punto flotante.** Cada monto lleva su moneda explícita (spec §4.1).
- **Nada se borra.** Los animales se archivan; la dirección permanente (`slug`) nunca cambia (spec §4.1).
- **Los permisos se verifican en la capa de dominio, no en la pantalla** (spec §7).
- **El registro de auditoría se escribe en la misma transacción que la acción** (spec §7).
- **El original de una imagen no se sirve nunca**; el tipo se valida por contenido real, no por extensión (spec §5).
- **Naranja = solo dinero.** El botón primario es tinta (`--brand`); el verde `--mark` es para navegación, foco y estados de interfaz (diseño §3).
- **Fraunces en todos los títulos (`h1`–`h4`), el logo y las dos piezas de exhibición**, con el dial de suavidad de la tabla de diseño §4.1: `SOFT 100` en el titular de portada y el logo, `SOFT 70` en el resto. Manrope en interfaz y texto corrido; la monoespaciada solo en datos auditables. Fraunces nunca en texto corrido, etiquetas, botones ni cifras (diseño §4).
- **Los tres estados de tema deben resolverse**: `:root`, `@media (prefers-color-scheme: dark)` con guarda `:root:not([data-theme="light"])`, y `:root[data-theme="dark"]`. Ningún color puede definirse únicamente dentro de un bloque de media query (diseño §2.1).
- **Área táctil mínima 44×44px, contraste 4.5:1, foco visible siempre** (diseño §9).
- **Idioma:** todo el código, los nombres de funciones y los mensajes en castellano rioplatense, sin voseo en la interfaz salvo donde el prototipo ya lo usa.
- Node 20 o superior. TypeScript en modo estricto. Sin `any` salvo con comentario que justifique.

---

## Estructura de archivos

```
prisma/
  schema.prisma                     Modelo completo (incluye finanzas y adopciones)
  migrations/                       Migraciones, incluida la SQL del disparador
src/
  app/
    layout.tsx                      Cascarón, fuentes, tokens
    page.tsx                        Portada
    adopcion/page.tsx               Listado con filtros
    adopcion/[slug]/page.tsx        Ficha permanente
    adopcion/[slug]/opengraph-image.tsx
    panel/layout.tsx                Cascarón del panel (verifica sesión)
    panel/page.tsx                  Tablero
    panel/animales/page.tsx         Listado interno
    panel/animales/[id]/page.tsx    Alta y edición
    api/auth/[...nextauth]/route.ts
    sitemap.ts  robots.ts
  domains/
    animales/
      tipos.ts                      Tipos del dominio y puerto del repositorio
      slug.ts                       Generación de dirección permanente
      esquemas.ts                   Validación con zod
      servicio.ts                   Reglas: crear, editar, publicar, archivar
    usuarios/
      tipos.ts  autorizacion.ts     Roles y permisos
    auditoria/
      tipos.ts  registrar.ts        Puerto y función de registro
  infra/
    prisma.ts                       Cliente único
    repositorios/animales.ts        Implementación Prisma de los puertos
                                    (repositorioPrisma y auditoriaPrisma)
    almacen/tipos.ts                Puerto AlmacenDeArchivos
    almacen/local.ts                Implementación para desarrollo
    imagenes/procesar.ts            Conversión, medidas, miniatura
    imagenes/validar.ts             Validación por contenido real
    auth.ts                         Configuración de Auth.js
  ui/
    tokens.css                      Variables del sistema de diseño
    globales.css
    componentes/                    Boton, Pildora, Card, Foto, Chip, Medidor...
tests/
  unidad/                           Dominio, sin base de datos
  integracion/                      Prisma y disparadores, requieren Postgres
  dobles/                           Repositorios en memoria
```

**Nota sobre pruebas:** no hay Docker en la máquina de desarrollo. Por eso los dominios dependen de puertos y sus pruebas corren en memoria, sin base. Solo las pruebas de integración (tareas 3, 4 y 14) necesitan un Postgres real: una rama de pruebas gratuita en Neon o un Postgres local, configurado en `DATABASE_URL_TEST`.

---

## Tarea 1: Arranque del proyecto y sistema de tokens

**Archivos:**
- Crear: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Crear: `src/app/layout.tsx`, `src/ui/tokens.css`, `src/ui/globales.css`
- Prueba: `tests/unidad/tokens.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: proyecto ejecutable con `npm run dev`, `npm test`; hoja de tokens importada globalmente.

- [ ] **Paso 1: Crear el proyecto**

```bash
npx create-next-app@latest . --typescript --app --no-tailwind --no-src-dir --eslint --import-alias "@/*" --use-npm
```

Cuando pregunte por sobrescribir archivos existentes, conservar `README.md` y `docs/`. Después mover el código a `src/`:

```bash
mkdir -p src && git mv app src/app 2>/dev/null || mv app src/app
```

- [ ] **Paso 2: Instalar dependencias**

```bash
npm install @prisma/client zod next-auth@beta sharp
npm install -D prisma vitest @vitejs/plugin-react tsx @types/node
```

- [ ] **Paso 3: Configurar Vitest**

Crear `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Agregar a `package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:migrate": "prisma migrate dev",
  "db:studio": "prisma studio"
}
```

- [ ] **Paso 4: Escribir la prueba de los tokens**

Esta prueba protege la regla de los tres estados de tema. Crear `tests/unidad/tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("src/ui/tokens.css", "utf8");

/** Extrae los nombres de variables definidas dentro de un bloque. */
function variablesEn(bloque: string): Set<string> {
  return new Set([...bloque.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
}

function bloque(selector: string): string {
  const i = css.indexOf(selector);
  if (i === -1) throw new Error(`No existe el bloque ${selector}`);
  const desde = css.indexOf("{", i);
  const hasta = css.indexOf("}", desde);
  return css.slice(desde, hasta);
}

describe("tokens del sistema de diseño", () => {
  it("define la paleta clara completa en :root sin marcar", () => {
    const claras = variablesEn(bloque(":root{"));
    expect(claras.has("--ground")).toBe(true);
    expect(claras.has("--accent")).toBe(true);
    expect(claras.has("--mark")).toBe(true);
  });

  it("redefine en oscuro exactamente las mismas variables que en claro", () => {
    const claras = variablesEn(bloque(":root{"));
    const oscuras = variablesEn(bloque(':root:not([data-theme="light"])'));
    expect([...oscuras].sort()).toEqual([...claras].sort());
  });

  it("resuelve también el tema oscuro elegido explícitamente", () => {
    const claras = variablesEn(bloque(":root{"));
    const estampadas = variablesEn(bloque(':root[data-theme="dark"]'));
    expect([...estampadas].sort()).toEqual([...claras].sort());
  });
});
```

- [ ] **Paso 5: Ejecutar la prueba y verificar que falla**

Ejecutar: `npm test`
Esperado: FALLA con `No existe el bloque :root{` — todavía no existe `tokens.css`.

- [ ] **Paso 6: Crear la hoja de tokens**

Copiar el bloque `:root`, el `@media (prefers-color-scheme: dark)` y el `:root[data-theme="dark"]` **desde el prototipo** `docs/prototipo/huellas-prototipo-v1.html` (están al comienzo de su `<style>`) a `src/ui/tokens.css`. Son los valores aprobados; no reinventarlos.

Los tres bloques deben declarar exactamente el mismo conjunto de variables. Escribir `:root{` sin espacio antes de la llave, como espera la prueba.

- [ ] **Paso 7: Ejecutar la prueba y verificar que pasa**

Ejecutar: `npm test`
Esperado: PASA, 3 pruebas.

- [ ] **Paso 8: Cascarón de la aplicación con las fuentes**

Crear `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Fraunces, Manrope, IBM_Plex_Mono } from "next/font/google";
import "@/ui/tokens.css";
import "@/ui/globales.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--fuente-display",
  display: "swap",
});
const manrope = Manrope({ subsets: ["latin"], variable: "--fuente-cuerpo", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Huellas", template: "%s — Huellas" },
  description: "Asociación Civil Huellas. Adopción responsable y transparencia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${fraunces.variable} ${manrope.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

Crear `src/ui/globales.css` con la base del prototipo: `box-sizing`, `body`, tipografía de títulos, `:focus-visible` en `--mark`, y el bloque `@media (prefers-reduced-motion: reduce)`.

- [ ] **Paso 9: Verificar que arranca**

Ejecutar: `npm run dev` y abrir `http://localhost:3000`
Esperado: la página por defecto de Next.js con el fondo `--ground` y las fuentes aplicadas.

- [ ] **Paso 10: Confirmar**

```bash
git add -A
git commit -m "feat: arranque del proyecto Next.js con el sistema de tokens

Los tokens se copian del prototipo aprobado. La prueba verifica que los
tres estados de tema declaren el mismo conjunto de variables: es el error
que deja texto de un tema sobre el fondo del otro."
```

---

## Tarea 2: Esquema de datos completo

**Archivos:**
- Crear: `prisma/schema.prisma`, `src/infra/prisma.ts`
- Modificar: `.env.example`

**Interfaces:**
- Consume: nada.
- Produce: `prisma` (cliente único exportado desde `@/infra/prisma`), todos los modelos de la spec §4.2.

- [ ] **Paso 1: Escribir el esquema**

Crear `prisma/schema.prisma` **copiando literalmente** los modelos de la spec §4.2 (`Animal`, `FotoAnimal`, `RedireccionDireccion`, `Usuario`, `RegistroAuditoria`, `CasoFinanciero`, `AsientoContable`, `EventoWebhook`) más los enums. Encabezado:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Se declara el modelo **completo**, incluidas las tablas financieras que recién se usan en la entrega 2. Es la decisión de la spec §1.

- [ ] **Paso 2: Cliente único**

Crear `src/infra/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = prisma;
```

En desarrollo, Next.js recarga los módulos en cada cambio; sin este guardado global se abrirían decenas de conexiones hasta agotar el límite del plan gratuito.

- [ ] **Paso 3: Documentar las variables de entorno**

Crear `.env.example`:

```
DATABASE_URL="postgresql://usuario:clave@host/huellas?sslmode=require"
DATABASE_URL_TEST="postgresql://usuario:clave@host/huellas_test?sslmode=require"
AUTH_SECRET="generar con: npx auth secret"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
ALMACEN_DIRECTORIO_LOCAL="./almacenamiento"
NEXT_PUBLIC_URL_BASE="http://localhost:3000"
```

Verificar que `.env` y `almacenamiento/` estén en `.gitignore`.

- [ ] **Paso 4: Crear la base y migrar**

Crear una base en Neon (plan gratuito) con una rama `test`, poner las dos URLs en `.env`, y ejecutar:

```bash
npx prisma migrate dev --name esquema_inicial
```

Esperado: la migración se aplica y se genera el cliente.

- [ ] **Paso 5: Confirmar**

```bash
git add prisma src/infra/prisma.ts .env.example .gitignore
git commit -m "feat: esquema de datos completo con cliente Prisma único"
```

---

## Tarea 3: Inmutabilidad del libro contable

Esta tarea implementa la regla que sostiene toda la promesa de transparencia. Va ahora, aunque las finanzas sean de la entrega 2: el disparador tiene que existir desde la primera migración, antes de que haya un solo asiento.

**Archivos:**
- Crear: `prisma/migrations/<fecha>_asientos_inmutables/migration.sql`
- Prueba: `tests/integracion/asientos-inmutables.test.ts`

**Interfaces:**
- Consume: `prisma` de la tarea 2.
- Produce: garantía en base de datos de que `AsientoContable` no admite `UPDATE` ni `DELETE`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/integracion/asientos-inmutables.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });

let casoId: string;
let asientoId: string;

beforeAll(async () => {
  const caso = await prisma.casoFinanciero.create({
    data: { slug: `prueba-${Date.now()}`, titulo: "Caso de prueba", situacion: "x", metaCentavos: 100n },
  });
  casoId = caso.id;
  const asiento = await prisma.asientoContable.create({
    data: {
      casoId,
      tipo: "DONACION",
      centavos: 5000n,
      descripcion: "Donación de prueba",
      fechaEfectiva: new Date(),
    },
  });
  asientoId = asiento.id;
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "CasoFinanciero" WHERE id = $1`, casoId);
  await prisma.$disconnect();
});

describe("el libro contable es solo de agregado", () => {
  it("rechaza modificar un asiento", async () => {
    await expect(
      prisma.asientoContable.update({ where: { id: asientoId }, data: { centavos: 999999n } })
    ).rejects.toThrow(/inmutable/i);
  });

  it("rechaza borrar un asiento", async () => {
    await expect(
      prisma.asientoContable.delete({ where: { id: asientoId } })
    ).rejects.toThrow(/inmutable/i);
  });

  it("permite agregar un asiento de ajuste que corrige al anterior", async () => {
    const ajuste = await prisma.asientoContable.create({
      data: {
        casoId,
        tipo: "AJUSTE",
        centavos: -5000n,
        descripcion: "Contracargo del pago",
        ajustaAId: asientoId,
        fechaEfectiva: new Date(),
      },
    });
    expect(ajuste.ajustaAId).toBe(asientoId);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/integracion/asientos-inmutables.test.ts`
Esperado: FALLAN las dos primeras — sin disparador, la base deja modificar y borrar.

- [ ] **Paso 3: Escribir la migración**

```bash
npx prisma migrate dev --create-only --name asientos_inmutables
```

Reemplazar el contenido del `migration.sql` generado por:

```sql
CREATE OR REPLACE FUNCTION rechazar_modificacion_asiento()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'El libro contable es inmutable: un asiento no se modifica ni se borra. Registrá un asiento de tipo AJUSTE que lo corrija.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER asiento_sin_update
  BEFORE UPDATE ON "AsientoContable"
  FOR EACH ROW EXECUTE FUNCTION rechazar_modificacion_asiento();

CREATE TRIGGER asiento_sin_delete
  BEFORE DELETE ON "AsientoContable"
  FOR EACH ROW EXECUTE FUNCTION rechazar_modificacion_asiento();
```

Aplicarla: `npx prisma migrate dev`

**Ojo:** el borrado en cascada desde `CasoFinanciero` también se bloquea, que es lo correcto — un caso con movimientos no se borra. Por eso la limpieza de la prueba borra el caso con SQL directo antes de que existan asientos huérfanos; si falla, borrar la fila a mano.

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/integracion/asientos-inmutables.test.ts`
Esperado: PASAN las 3.

- [ ] **Paso 5: Confirmar**

```bash
git add prisma tests/integracion
git commit -m "feat: disparador que hace inmutable el libro contable

Prisma no puede expresar esta garantía. Sin el disparador, la
inmutabilidad sería una convención del código en lugar de una regla de
la base."
```

---

## Tarea 4: Dominio de animales — dirección permanente

**Archivos:**
- Crear: `src/domains/animales/slug.ts`
- Prueba: `tests/unidad/slug.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: `generarSlug(nombre: string): string`, `slugDisponible(slug: string, existentes: string[]): string`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generarSlug, slugDisponible } from "@/domains/animales/slug";

describe("generarSlug", () => {
  it("pasa a minúsculas y une con guiones", () => {
    expect(generarSlug("Juanito Pérez")).toBe("juanito-perez");
  });

  it("quita acentos y la eñe se vuelve n", () => {
    expect(generarSlug("Ñoño")).toBe("nono");
  });

  it("descarta signos y espacios repetidos", () => {
    expect(generarSlug("  Luna  —  ¡cirugía!  ")).toBe("luna-cirugia");
  });

  it("nunca devuelve vacío", () => {
    expect(generarSlug("¿¡!")).toBe("animal");
  });
});

describe("slugDisponible", () => {
  it("devuelve el mismo si nadie lo usa", () => {
    expect(slugDisponible("luna", [])).toBe("luna");
  });

  it("agrega un sufijo numérico si ya existe", () => {
    expect(slugDisponible("luna", ["luna"])).toBe("luna-2");
    expect(slugDisponible("luna", ["luna", "luna-2"])).toBe("luna-3");
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/slug.test.ts`
Esperado: FALLA con "Cannot find module '@/domains/animales/slug'".

- [ ] **Paso 3: Implementar**

Crear `src/domains/animales/slug.ts`:

```ts
/**
 * La dirección de un animal es permanente: se genera una sola vez, al crearlo,
 * y no cambia aunque después se corrija el nombre. Los enlaces que circularon
 * por Facebook tienen que seguir funcionando para siempre.
 */
export function generarSlug(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpio.length > 0 ? limpio : "animal";
}

export function slugDisponible(base: string, existentes: string[]): string {
  if (!existentes.includes(base)) return base;
  let n = 2;
  while (existentes.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/slug.test.ts`
Esperado: PASAN las 6.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/animales/slug.ts tests/unidad/slug.test.ts
git commit -m "feat: generación de direcciones permanentes de animales"
```

---

## Tarea 5: Dominio de animales — puerto, validación y alta

**Archivos:**
- Crear: `src/domains/animales/tipos.ts`, `src/domains/animales/esquemas.ts`, `src/domains/animales/servicio.ts`
- Crear: `tests/dobles/repositorio-animales-memoria.ts`
- Prueba: `tests/unidad/animales-crear.test.ts`

**Interfaces:**
- Consume: `generarSlug`, `slugDisponible` (tarea 4).
- Produce:
  - `type RepositorioAnimales` con `crear`, `actualizar`, `porId`, `porSlug`, `slugsExistentes`, `listar`
  - `type PuertoAuditoria` con `registrar(entrada)`
  - `crearAnimal(datos, contexto): Promise<Animal>`
  - `EntradaAnimal` (tipo validado por zod)

- [ ] **Paso 1: Definir tipos y puertos**

Crear `src/domains/animales/tipos.ts`:

```ts
export type EstadoAnimal =
  | "BORRADOR" | "DISPONIBLE" | "EN_EVALUACION" | "RESERVADO"
  | "ADOPTADO" | "TRANSITO" | "TRATAMIENTO" | "NO_DISPONIBLE" | "FALLECIDO";

export type Especie = "PERRO" | "GATO" | "OTRO";
export type Sexo = "MACHO" | "HEMBRA";
export type Tamano = "PEQUENO" | "MEDIANO" | "GRANDE";

export interface Animal {
  id: string;
  slug: string;
  nombre: string;
  especie: Especie;
  sexo: Sexo;
  tamano: Tamano;
  descripcion: string;
  estado: EstadoAnimal;
  archivado: boolean;
  publicadoEn: Date | null;
  atributos: Record<string, unknown>;
}

export interface FiltroAnimales {
  especie?: Especie;
  tamano?: Tamano;
  estado?: EstadoAnimal;
  soloPublicados?: boolean;
}

export interface RepositorioAnimales {
  crear(datos: Omit<Animal, "id">): Promise<Animal>;
  actualizar(id: string, cambios: Partial<Animal>): Promise<Animal>;
  porId(id: string): Promise<Animal | null>;
  porSlug(slug: string): Promise<Animal | null>;
  slugsExistentes(): Promise<string[]>;
  listar(filtro: FiltroAnimales): Promise<Animal[]>;
}

export interface EntradaAuditoria {
  usuarioEmail: string;
  accion: string;
  entidad: string;
  entidadId: string;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
}

export interface PuertoAuditoria {
  registrar(entrada: EntradaAuditoria): Promise<void>;
}

export interface Contexto {
  usuarioEmail: string;
  rol: "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";
  repositorio: RepositorioAnimales;
  auditoria: PuertoAuditoria;
}
```

- [ ] **Paso 2: Escribir la prueba que falla**

Crear el doble en `tests/dobles/repositorio-animales-memoria.ts`:

```ts
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
```

Crear `tests/unidad/animales-crear.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { crearAnimal } from "@/domains/animales/servicio";
import { repositorioEnMemoria, auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

const datosValidos = {
  nombre: "Juanito",
  especie: "PERRO" as const,
  sexo: "MACHO" as const,
  tamano: "MEDIANO" as const,
  descripcion: "Lo encontraron atado a un poste en barrio Tablada.",
};

function contexto(rol: "ADMINISTRACION" | "ANIMALES" | "REDACCION" | "FINANZAS" = "ANIMALES") {
  return {
    usuarioEmail: "marina@huellas.org.ar",
    rol,
    repositorio: repositorioEnMemoria(),
    auditoria: auditoriaEnMemoria(),
  };
}

describe("crearAnimal", () => {
  it("nace en borrador, sin publicar", async () => {
    const animal = await crearAnimal(datosValidos, contexto());
    expect(animal.estado).toBe("BORRADOR");
    expect(animal.publicadoEn).toBeNull();
  });

  it("le asigna una dirección permanente a partir del nombre", async () => {
    const animal = await crearAnimal(datosValidos, contexto());
    expect(animal.slug).toBe("juanito");
  });

  it("evita colisiones de dirección", async () => {
    const ctx = contexto();
    await crearAnimal(datosValidos, ctx);
    const segundo = await crearAnimal(datosValidos, ctx);
    expect(segundo.slug).toBe("juanito-2");
  });

  it("rechaza una descripción vacía", async () => {
    await expect(
      crearAnimal({ ...datosValidos, descripcion: "" }, contexto())
    ).rejects.toThrow(/descripción/i);
  });

  it("rechaza al rol de redacción aunque llame directo a la función", async () => {
    await expect(crearAnimal(datosValidos, contexto("REDACCION"))).rejects.toThrow(/permiso/i);
  });

  it("deja rastro en auditoría", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(datosValidos, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas).toHaveLength(1);
    expect(auditoria.entradas[0]).toMatchObject({
      accion: "animal.crear",
      entidad: "Animal",
      entidadId: animal.id,
      usuarioEmail: "marina@huellas.org.ar",
    });
  });
});
```

- [ ] **Paso 3: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/animales-crear.test.ts`
Esperado: FALLA — no existe `servicio.ts`.

- [ ] **Paso 4: Implementar la validación**

Crear `src/domains/animales/esquemas.ts`:

```ts
import { z } from "zod";

export const esquemaAnimal = z.object({
  nombre: z.string().trim().min(1, "El animal necesita un nombre").max(60),
  especie: z.enum(["PERRO", "GATO", "OTRO"]),
  sexo: z.enum(["MACHO", "HEMBRA"]),
  tamano: z.enum(["PEQUENO", "MEDIANO", "GRANDE"]),
  descripcion: z.string().trim().min(20, "La descripción tiene que contar su historia"),
  personalidad: z.string().trim().optional(),
  zona: z.string().trim().optional(),
  requisitos: z.string().trim().optional(),
  atributos: z.record(z.string(), z.unknown()).default({}),
});

export type EntradaAnimal = z.input<typeof esquemaAnimal>;
```

- [ ] **Paso 5: Implementar el servicio**

Crear `src/domains/animales/servicio.ts`:

```ts
import { esquemaAnimal, type EntradaAnimal } from "./esquemas";
import { generarSlug, slugDisponible } from "./slug";
import type { Animal, Contexto } from "./tipos";

const ROLES_QUE_GESTIONAN_ANIMALES = ["ADMINISTRACION", "ANIMALES"];

/** El permiso se verifica acá, no en la pantalla: esconder un botón no es seguridad. */
function exigirPermisoSobreAnimales(ctx: Contexto): void {
  if (!ROLES_QUE_GESTIONAN_ANIMALES.includes(ctx.rol)) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para gestionar animales`);
  }
}

export async function crearAnimal(entrada: EntradaAnimal, ctx: Contexto): Promise<Animal> {
  exigirPermisoSobreAnimales(ctx);

  const datos = esquemaAnimal.parse(entrada);
  const existentes = await ctx.repositorio.slugsExistentes();
  const slug = slugDisponible(generarSlug(datos.nombre), existentes);

  const animal = await ctx.repositorio.crear({
    ...datos,
    slug,
    estado: "BORRADOR",
    archivado: false,
    publicadoEn: null,
    atributos: datos.atributos,
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "animal.crear",
    entidad: "Animal",
    entidadId: animal.id,
    valorNuevo: animal,
  });

  return animal;
}
```

- [ ] **Paso 6: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/animales-crear.test.ts`
Esperado: PASAN las 6.

- [ ] **Paso 7: Confirmar**

```bash
git add src/domains/animales tests
git commit -m "feat: alta de animales con validación, permisos y auditoría"
```

---

## Tarea 6: Dominio de animales — publicar, editar, archivar y redirecciones

**Archivos:**
- Modificar: `src/domains/animales/servicio.ts`, `src/domains/animales/tipos.ts`
- Prueba: `tests/unidad/animales-ciclo.test.ts`

**Interfaces:**
- Consume: todo lo de la tarea 5.
- Produce: `publicarAnimal(id, ctx)`, `editarAnimal(id, cambios, ctx)`, `cambiarEstado(id, estado, ctx)`, `archivarAnimal(id, ctx)`. El puerto suma `registrarRedireccion(slugAnterior, animalId)`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/animales-ciclo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { crearAnimal, publicarAnimal, editarAnimal, cambiarEstado, archivarAnimal } from "@/domains/animales/servicio";
import { repositorioEnMemoria, auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

const base = {
  nombre: "Juanito",
  especie: "PERRO" as const,
  sexo: "MACHO" as const,
  tamano: "MEDIANO" as const,
  descripcion: "Lo encontraron atado a un poste en barrio Tablada.",
};

function contexto() {
  return {
    usuarioEmail: "marina@huellas.org.ar",
    rol: "ANIMALES" as const,
    repositorio: repositorioEnMemoria(),
    auditoria: auditoriaEnMemoria(),
  };
}

describe("ciclo de vida del animal", () => {
  it("al publicar pasa a disponible y queda la fecha", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(base, ctx);
    const publicado = await publicarAnimal(animal.id, ctx);
    expect(publicado.estado).toBe("DISPONIBLE");
    expect(publicado.publicadoEn).toBeInstanceOf(Date);
  });

  it("no publica un animal sin descripción suficiente", async () => {
    const ctx = contexto();
    const animal = await ctx.repositorio.crear({
      slug: "corto", nombre: "Corto", especie: "PERRO", sexo: "MACHO", tamano: "MEDIANO",
      descripcion: "corta", estado: "BORRADOR", archivado: false, publicadoEn: null, atributos: {},
    });
    await expect(publicarAnimal(animal.id, ctx)).rejects.toThrow(/descripción/i);
  });

  it("la dirección permanente NO cambia al corregir el nombre", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(base, ctx);
    const editado = await editarAnimal(animal.id, { nombre: "Juan Ramón" }, ctx);
    expect(editado.nombre).toBe("Juan Ramón");
    expect(editado.slug).toBe("juanito");
  });

  it("un animal adoptado sigue publicado", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(base, ctx);
    await publicarAnimal(animal.id, ctx);
    const adoptado = await cambiarEstado(animal.id, "ADOPTADO", ctx);
    expect(adoptado.estado).toBe("ADOPTADO");
    expect(adoptado.archivado).toBe(false);
    expect(adoptado.publicadoEn).not.toBeNull();
  });

  it("archivar no borra: la ficha sigue existiendo", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(base, ctx);
    await archivarAnimal(animal.id, ctx);
    expect(await ctx.repositorio.porSlug("juanito")).not.toBeNull();
  });

  it("cada cambio de estado deja su rastro con valor anterior y nuevo", async () => {
    const ctx = contexto();
    const animal = await crearAnimal(base, ctx);
    await cambiarEstado(animal.id, "TRATAMIENTO", ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    const ultima = auditoria.entradas.at(-1)!;
    expect(ultima.accion).toBe("animal.cambiarEstado");
    expect(ultima.valorAnterior).toMatchObject({ estado: "BORRADOR" });
    expect(ultima.valorNuevo).toMatchObject({ estado: "TRATAMIENTO" });
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/animales-ciclo.test.ts`
Esperado: FALLA — las funciones no existen.

- [ ] **Paso 3: Implementar**

Agregar a `src/domains/animales/servicio.ts`:

```ts
import { esquemaAnimal } from "./esquemas";
import type { Animal, Contexto, EstadoAnimal } from "./tipos";

async function exigirAnimal(id: string, ctx: Contexto): Promise<Animal> {
  const animal = await ctx.repositorio.porId(id);
  if (!animal) throw new Error("No existe el animal");
  return animal;
}

export async function publicarAnimal(id: string, ctx: Contexto): Promise<Animal> {
  exigirPermisoSobreAnimales(ctx);
  const animal = await exigirAnimal(id, ctx);

  // Publicar exige la misma calidad mínima que crear: una ficha a medio
  // escribir es un enlace que va a circular por Facebook durante años.
  esquemaAnimal.parse(animal);

  const publicado = await ctx.repositorio.actualizar(id, {
    estado: "DISPONIBLE",
    publicadoEn: animal.publicadoEn ?? new Date(),
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "animal.publicar",
    entidad: "Animal",
    entidadId: id,
    valorAnterior: { estado: animal.estado },
    valorNuevo: { estado: publicado.estado },
  });
  return publicado;
}

export async function editarAnimal(
  id: string,
  cambios: Partial<Omit<Animal, "id" | "slug">>,
  ctx: Contexto
): Promise<Animal> {
  exigirPermisoSobreAnimales(ctx);
  const anterior = await exigirAnimal(id, ctx);

  // El slug se ignora de forma explícita: la dirección es permanente.
  const { slug: _descartado, ...seguros } = cambios as Partial<Animal>;
  const editado = await ctx.repositorio.actualizar(id, seguros);

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "animal.editar",
    entidad: "Animal",
    entidadId: id,
    valorAnterior: anterior,
    valorNuevo: editado,
  });
  return editado;
}

export async function cambiarEstado(id: string, estado: EstadoAnimal, ctx: Contexto): Promise<Animal> {
  exigirPermisoSobreAnimales(ctx);
  const anterior = await exigirAnimal(id, ctx);
  const nuevo = await ctx.repositorio.actualizar(id, { estado });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "animal.cambiarEstado",
    entidad: "Animal",
    entidadId: id,
    valorAnterior: { estado: anterior.estado },
    valorNuevo: { estado: nuevo.estado },
  });
  return nuevo;
}

/** Archivar saca al animal de los listados, pero su ficha sigue en línea. */
export async function archivarAnimal(id: string, ctx: Contexto): Promise<Animal> {
  exigirPermisoSobreAnimales(ctx);
  const anterior = await exigirAnimal(id, ctx);
  const archivado = await ctx.repositorio.actualizar(id, { archivado: true });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "animal.archivar",
    entidad: "Animal",
    entidadId: id,
    valorAnterior: { archivado: anterior.archivado },
    valorNuevo: { archivado: true },
  });
  return archivado;
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/animales-ciclo.test.ts`
Esperado: PASAN las 6.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/animales/servicio.ts tests/unidad/animales-ciclo.test.ts
git commit -m "feat: ciclo de vida del animal con dirección permanente"
```

---

## Tarea 7: Repositorios Prisma y auditoría transaccional

**Archivos:**
- Crear: `src/infra/repositorios/animales.ts`, `src/infra/repositorios/auditoria.ts`, `src/domains/animales/contexto.ts`
- Prueba: `tests/integracion/repositorio-animales.test.ts`

**Interfaces:**
- Consume: puertos de la tarea 5, `prisma` de la tarea 2.
- Produce: `repositorioPrisma(tx?)`, `auditoriaPrisma(tx?)`, `conContexto(usuario, fn)` que corre una operación de dominio dentro de una transacción.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/integracion/repositorio-animales.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearAnimal } from "@/domains/animales/servicio";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const creados: string[] = [];

afterAll(async () => {
  await prisma.registroAuditoria.deleteMany({ where: { entidadId: { in: creados } } });
  await prisma.animal.deleteMany({ where: { id: { in: creados } } });
  await prisma.$disconnect();
});

describe("repositorio Prisma de animales", () => {
  it("guarda y recupera por dirección permanente", async () => {
    const nombre = `Prueba ${Date.now()}`;
    const animal = await prisma.$transaction(async (tx) =>
      crearAnimal(
        { nombre, especie: "PERRO", sexo: "MACHO", tamano: "MEDIANO", descripcion: "Descripción de prueba suficientemente larga." },
        {
          usuarioEmail: "prueba@huellas.org.ar",
          rol: "ANIMALES",
          repositorio: repositorioPrisma(tx),
          auditoria: auditoriaPrisma(tx),
        }
      )
    );
    creados.push(animal.id);

    const recuperado = await repositorioPrisma(prisma).porSlug(animal.slug);
    expect(recuperado?.nombre).toBe(nombre);
  });

  it("si falla la auditoría, no queda el animal: van en la misma transacción", async () => {
    const antes = await prisma.animal.count();
    await expect(
      prisma.$transaction(async (tx) =>
        crearAnimal(
          { nombre: "Fallará", especie: "PERRO", sexo: "MACHO", tamano: "MEDIANO", descripcion: "Descripción de prueba suficientemente larga." },
          {
            usuarioEmail: "prueba@huellas.org.ar",
            rol: "ANIMALES",
            repositorio: repositorioPrisma(tx),
            auditoria: { async registrar() { throw new Error("auditoría caída"); } },
          }
        )
      )
    ).rejects.toThrow(/auditoría caída/);
    expect(await prisma.animal.count()).toBe(antes);
  });
});
```

La segunda prueba es la importante: verifica la regla de "o quedan las dos, o no queda ninguna".

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/integracion/repositorio-animales.test.ts`
Esperado: FALLA — no existen los repositorios.

- [ ] **Paso 3: Implementar los repositorios**

Crear `src/infra/repositorios/animales.ts`:

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import type { Animal, FiltroAnimales, RepositorioAnimales, PuertoAuditoria } from "@/domains/animales/tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

export function repositorioPrisma(cliente: ClienteBase = clientePorDefecto): RepositorioAnimales {
  return {
    async crear(datos) {
      return (await cliente.animal.create({ data: datos as never })) as unknown as Animal;
    },
    async actualizar(id, cambios) {
      return (await cliente.animal.update({ where: { id }, data: cambios as never })) as unknown as Animal;
    },
    async porId(id) {
      return (await cliente.animal.findUnique({ where: { id } })) as unknown as Animal | null;
    },
    async porSlug(slug) {
      return (await cliente.animal.findUnique({ where: { slug } })) as unknown as Animal | null;
    },
    async slugsExistentes() {
      const filas = await cliente.animal.findMany({ select: { slug: true } });
      return filas.map((f) => f.slug);
    },
    async listar(filtro: FiltroAnimales) {
      return (await cliente.animal.findMany({
        where: {
          especie: filtro.especie,
          tamano: filtro.tamano,
          estado: filtro.estado,
          ...(filtro.soloPublicados ? { publicadoEn: { not: null }, archivado: false } : {}),
        },
        orderBy: [{ publicadoEn: "desc" }],
      })) as unknown as Animal[];
    },
  };
}

export function auditoriaPrisma(cliente: ClienteBase = clientePorDefecto): PuertoAuditoria {
  return {
    async registrar(entrada) {
      await cliente.registroAuditoria.create({
        data: {
          usuarioEmail: entrada.usuarioEmail,
          accion: entrada.accion,
          entidad: entrada.entidad,
          entidadId: entrada.entidadId,
          valorAnterior: (entrada.valorAnterior ?? null) as never,
          valorNuevo: (entrada.valorNuevo ?? null) as never,
        },
      });
    },
  };
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/integracion/repositorio-animales.test.ts`
Esperado: PASAN las 2.

- [ ] **Paso 5: Confirmar**

```bash
git add src/infra/repositorios tests/integracion/repositorio-animales.test.ts
git commit -m "feat: repositorios Prisma con auditoría en la misma transacción"
```

---

## Tarea 8: Acceso con Google y lista de autorizados

**Archivos:**
- Crear: `src/infra/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/domains/usuarios/autorizacion.ts`
- Crear: `prisma/seed.ts`
- Prueba: `tests/unidad/autorizacion.test.ts`

**Interfaces:**
- Consume: `prisma`.
- Produce: `auth()`, `signIn()`, `signOut()`; `puede(rol, accion): boolean`; `sesionRequerida(): Promise<{email, rol}>`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/autorizacion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { puede } from "@/domains/usuarios/autorizacion";

describe("permisos por rol", () => {
  it("administración puede todo", () => {
    expect(puede("ADMINISTRACION", "animales.escribir")).toBe(true);
    expect(puede("ADMINISTRACION", "finanzas.escribir")).toBe(true);
  });

  it("animales gestiona animales pero solo lee finanzas", () => {
    expect(puede("ANIMALES", "animales.escribir")).toBe(true);
    expect(puede("ANIMALES", "finanzas.escribir")).toBe(false);
    expect(puede("ANIMALES", "finanzas.leer")).toBe(true);
  });

  it("finanzas no accede a postulaciones", () => {
    expect(puede("FINANZAS", "postulaciones.leer")).toBe(false);
    expect(puede("FINANZAS", "finanzas.escribir")).toBe(true);
  });

  it("redacción solo escribe novedades", () => {
    expect(puede("REDACCION", "novedades.escribir")).toBe(true);
    expect(puede("REDACCION", "animales.escribir")).toBe(false);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/autorizacion.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar los permisos**

Crear `src/domains/usuarios/autorizacion.ts`:

```ts
export type Rol = "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";

export type Accion =
  | "animales.leer" | "animales.escribir"
  | "postulaciones.leer" | "postulaciones.escribir"
  | "finanzas.leer" | "finanzas.escribir"
  | "novedades.escribir";

/** Tabla de la spec §7. Ningún rol puede escribir el total recaudado: eso no es una acción. */
const PERMISOS: Record<Rol, Accion[]> = {
  ADMINISTRACION: [
    "animales.leer", "animales.escribir",
    "postulaciones.leer", "postulaciones.escribir",
    "finanzas.leer", "finanzas.escribir", "novedades.escribir",
  ],
  ANIMALES: [
    "animales.leer", "animales.escribir",
    "postulaciones.leer", "postulaciones.escribir",
    "finanzas.leer", "novedades.escribir",
  ],
  FINANZAS: ["animales.leer", "finanzas.leer", "finanzas.escribir"],
  REDACCION: ["animales.leer", "finanzas.leer", "novedades.escribir"],
};

export function puede(rol: Rol, accion: Accion): boolean {
  return PERMISOS[rol].includes(accion);
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/autorizacion.test.ts`
Esperado: PASAN las 4.

- [ ] **Paso 5: Configurar Auth.js**

Crear `src/infra/auth.ts`:

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/infra/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/panel/entrar" },
  callbacks: {
    /** No hay registro público: si el correo no está en la tabla, no entra. */
    async signIn({ user }) {
      if (!user.email) return false;
      const autorizado = await prisma.usuario.findUnique({ where: { email: user.email } });
      return Boolean(autorizado?.activo);
    },
    async jwt({ token }) {
      if (token.email) {
        const usuario = await prisma.usuario.findUnique({ where: { email: token.email } });
        token.rol = usuario?.rol ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.rol = token.rol as string | null;
      return session;
    },
  },
});
```

Crear `src/app/api/auth/[...nextauth]/route.ts`:

```ts
export { GET, POST } from "@/infra/auth";
```

- [ ] **Paso 6: Semilla del primer usuario**

Crear `prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const email = process.env.EMAIL_ADMINISTRACION;
  if (!email) throw new Error("Definí EMAIL_ADMINISTRACION antes de sembrar");
  await prisma.usuario.upsert({
    where: { email },
    update: { rol: "ADMINISTRACION", activo: true },
    create: { email, nombre: "Administración", rol: "ADMINISTRACION" },
  });
  console.log(`Usuario de administración listo: ${email}`);
}

main().finally(() => prisma.$disconnect());
```

Ejecutar: `EMAIL_ADMINISTRACION=tu@correo.com npx tsx prisma/seed.ts`

- [ ] **Paso 7: Verificar el ingreso a mano**

Crear las credenciales de OAuth en Google Cloud con el origen `http://localhost:3000` y la ruta de retorno `http://localhost:3000/api/auth/callback/google`. Ponerlas en `.env`.

Ejecutar `npm run dev`, entrar a `/panel` con la cuenta sembrada: debe dejar pasar. Probar con otra cuenta de Google: debe rechazar.

- [ ] **Paso 8: Unificar la verificación de permisos**

La tarea 5 dejó la lista de roles escrita a mano dentro de `servicio.ts`. Ahora que existe `puede()`, hay una sola fuente de verdad. Reemplazar en `src/domains/animales/servicio.ts`:

```ts
import { puede } from "@/domains/usuarios/autorizacion";

function exigirPermisoSobreAnimales(ctx: Contexto): void {
  if (!puede(ctx.rol, "animales.escribir")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para gestionar animales`);
  }
}
```

Borrar la constante `ROLES_QUE_GESTIONAN_ANIMALES`.

- [ ] **Paso 9: Verificar que las pruebas siguen pasando**

Ejecutar: `npm test`
Esperado: PASA todo, incluidas las de las tareas 5 y 6. Si alguna falla, la tabla de permisos y las expectativas de las pruebas no coinciden: revisar cuál de las dos está mal antes de tocar nada.

- [ ] **Paso 10: Confirmar**

```bash
git add src/infra/auth.ts src/app/api src/domains prisma/seed.ts tests/unidad/autorizacion.test.ts
git commit -m "feat: acceso con Google contra lista de autorizados y tabla de permisos

La verificación de permisos queda con una sola fuente de verdad: la
tabla de la spec §7, consultada desde la capa de dominio."
```

---

## Tarea 9: Almacén de archivos y procesamiento de imágenes

**Archivos:**
- Crear: `src/infra/almacen/tipos.ts`, `src/infra/almacen/local.ts`, `src/infra/imagenes/validar.ts`, `src/infra/imagenes/procesar.ts`
- Prueba: `tests/unidad/validar-imagen.test.ts`, `tests/unidad/procesar-imagen.test.ts`

**Interfaces:**
- Consume: nada.
- Produce:
  - `interface AlmacenDeArchivos { guardar(clave, datos, tipo): Promise<void>; url(clave): string; borrar(clave): Promise<void> }`
  - `validarImagen(buffer): Promise<"image/jpeg" | "image/png" | "image/webp">` — lanza si no es imagen
  - `procesarImagen(buffer): Promise<{ medidas: {ancho, clave, datos}[]; placeholder: string; ancho: number; alto: number }>`

- [ ] **Paso 1: Escribir la prueba de validación**

Crear `tests/unidad/validar-imagen.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validarImagen } from "@/infra/imagenes/validar";

// Firmas reales de archivo. La extensión y el tipo declarado por el navegador
// se ignoran: los pone quien sube el archivo.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const EJECUTABLE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0]);

describe("validarImagen", () => {
  it("acepta PNG por su firma", async () => {
    await expect(validarImagen(PNG)).resolves.toBe("image/png");
  });

  it("acepta JPEG por su firma", async () => {
    await expect(validarImagen(JPEG)).resolves.toBe("image/jpeg");
  });

  it("rechaza un ejecutable aunque se llame foto.jpg", async () => {
    await expect(validarImagen(EJECUTABLE)).rejects.toThrow(/no es una imagen/i);
  });

  it("rechaza un archivo vacío", async () => {
    await expect(validarImagen(Buffer.alloc(0))).rejects.toThrow(/no es una imagen/i);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/validar-imagen.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar la validación**

Crear `src/infra/imagenes/validar.ts`:

```ts
export type TipoImagen = "image/jpeg" | "image/png" | "image/webp";

const FIRMAS: Array<{ tipo: TipoImagen; bytes: number[]; desde: number }> = [
  { tipo: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47], desde: 0 },
  { tipo: "image/jpeg", bytes: [0xff, 0xd8, 0xff], desde: 0 },
  { tipo: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], desde: 8 },
];

/**
 * El tipo se determina por el contenido real del archivo. Ni la extensión ni
 * el tipo que declara el navegador sirven: los controla quien sube el archivo.
 */
export async function validarImagen(datos: Buffer): Promise<TipoImagen> {
  for (const firma of FIRMAS) {
    const trozo = datos.subarray(firma.desde, firma.desde + firma.bytes.length);
    if (trozo.length === firma.bytes.length && firma.bytes.every((b, i) => trozo[i] === b)) {
      return firma.tipo;
    }
  }
  throw new Error("El archivo no es una imagen válida");
}

export const TAMANO_MAXIMO_BYTES = 12 * 1024 * 1024;
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/validar-imagen.test.ts`
Esperado: PASAN las 4.

- [ ] **Paso 5: Escribir la prueba del procesamiento**

Crear `tests/unidad/procesar-imagen.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { procesarImagen, MEDIDAS } from "@/infra/imagenes/procesar";

async function imagenDePrueba(ancho: number, alto: number): Promise<Buffer> {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: "#0E6B57" } })
    .jpeg()
    .toBuffer();
}

describe("procesarImagen", () => {
  it("genera todas las medidas menores o iguales al original", async () => {
    const resultado = await procesarImagen(await imagenDePrueba(2000, 1500));
    expect(resultado.medidas.map((m) => m.ancho)).toEqual(MEDIDAS);
  });

  it("no agranda una imagen chica", async () => {
    const resultado = await procesarImagen(await imagenDePrueba(400, 300));
    expect(resultado.medidas.every((m) => m.ancho <= 400)).toBe(true);
  });

  it("devuelve las dimensiones originales para reservar el espacio", async () => {
    const resultado = await procesarImagen(await imagenDePrueba(1200, 900));
    expect(resultado.ancho).toBe(1200);
    expect(resultado.alto).toBe(900);
  });

  it("produce una miniatura embebida chica", async () => {
    const resultado = await procesarImagen(await imagenDePrueba(1200, 900));
    expect(resultado.placeholder.startsWith("data:image/webp;base64,")).toBe(true);
    expect(resultado.placeholder.length).toBeLessThan(2000);
  });
});
```

- [ ] **Paso 6: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/procesar-imagen.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 7: Implementar el procesamiento**

Crear `src/infra/imagenes/procesar.ts`:

```ts
import sharp from "sharp";

export const MEDIDAS = [320, 640, 1024, 1600] as const;

export interface ImagenProcesada {
  medidas: Array<{ ancho: number; datos: Buffer }>;
  placeholder: string;
  ancho: number;
  alto: number;
}

/**
 * El original nunca se sirve. Se generan varias medidas en WebP más una
 * miniatura embebida que reserva el espacio mientras carga, para que la
 * página no salte.
 */
export async function procesarImagen(datos: Buffer): Promise<ImagenProcesada> {
  const original = sharp(datos).rotate(); // respeta la orientación EXIF
  const meta = await original.metadata();
  const ancho = meta.width ?? 0;
  const alto = meta.height ?? 0;

  const medidas = await Promise.all(
    MEDIDAS.map(async (medida) => ({
      ancho: Math.min(medida, ancho),
      datos: await sharp(datos)
        .rotate()
        .resize({ width: medida, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer(),
    }))
  );

  const miniatura = await sharp(datos).rotate().resize({ width: 16 }).webp({ quality: 30 }).toBuffer();

  return {
    medidas,
    placeholder: `data:image/webp;base64,${miniatura.toString("base64")}`,
    ancho,
    alto,
  };
}
```

- [ ] **Paso 8: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/procesar-imagen.test.ts`
Esperado: PASAN las 4.

- [ ] **Paso 9: Implementar el almacén**

Crear `src/infra/almacen/tipos.ts`:

```ts
export interface AlmacenDeArchivos {
  guardar(clave: string, datos: Buffer, tipo: string): Promise<void>;
  url(clave: string): string;
  borrar(clave: string): Promise<void>;
}
```

Crear `src/infra/almacen/local.ts`:

```ts
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { AlmacenDeArchivos } from "./tipos";

/**
 * Implementación para desarrollo. En producción se reemplaza por una
 * S3-compatible sin tocar nada fuera de este directorio: la base guarda la
 * clave del archivo, nunca la URL completa.
 */
export function almacenLocal(directorio = process.env.ALMACEN_DIRECTORIO_LOCAL ?? "./almacenamiento"): AlmacenDeArchivos {
  return {
    async guardar(clave, datos) {
      const destino = path.join(directorio, clave);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, datos);
    },
    url(clave) {
      return `/archivos/${clave}`;
    },
    async borrar(clave) {
      await unlink(path.join(directorio, clave)).catch(() => {});
    },
  };
}
```

Agregar la ruta que sirve los archivos en desarrollo: `src/app/archivos/[...clave]/route.ts`, leyendo del directorio local y devolviendo el archivo con `Cache-Control: public, max-age=31536000, immutable`.

- [ ] **Paso 10: Confirmar**

```bash
git add src/infra/almacen src/infra/imagenes src/app/archivos tests/unidad/validar-imagen.test.ts tests/unidad/procesar-imagen.test.ts
git commit -m "feat: almacén de archivos y pipeline de imágenes

El original no se sirve nunca. El tipo se valida por contenido real,
porque la extensión la controla quien sube el archivo."
```

---

## Tarea 10: Componentes de interfaz del sistema de diseño

**Archivos:**
- Crear: `src/ui/componentes/Boton.tsx`, `Pildora.tsx`, `Card.tsx`, `Chip.tsx`, `Foto.tsx`, `CompuertaSensible.tsx`
- Crear: los `.module.css` de cada uno
- Prueba: `tests/unidad/componentes-reglas.test.ts`

**Interfaces:**
- Consume: `src/ui/tokens.css`.
- Produce: `<Boton variante="donar" | "primario" | "fantasma" tamano?="sm">`, `<Pildora tono="ok"|"warn"|"bad"|"neutro"|"marca"|"adoptado">`, `<Foto>` con soporte de imagen sensible.

- [ ] **Paso 1: Escribir la prueba de las reglas de color**

Esta prueba protege la regla más importante del sistema de diseño: el naranja es solo para dinero. Crear `tests/unidad/componentes-reglas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = "src/ui/componentes";
const hojas = readdirSync(dir).filter((f) => f.endsWith(".module.css"));

function contenido(archivo: string): string {
  return readFileSync(path.join(dir, archivo), "utf8");
}

describe("reglas del sistema de diseño", () => {
  it("ningún componente escribe un color literal", () => {
    for (const hoja of hojas) {
      const literales = contenido(hoja).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      expect(literales, `${hoja} tiene colores literales: ${literales.join(", ")}`).toHaveLength(0);
    }
  });

  it("solo el botón de donar usa el acento naranja", () => {
    for (const hoja of hojas) {
      if (hoja === "Boton.module.css") continue;
      expect(contenido(hoja).includes("var(--accent)"), `${hoja} usa el naranja reservado al dinero`).toBe(false);
    }
  });

  it("todo control interactivo declara un área táctil suficiente", () => {
    for (const hoja of ["Boton.module.css", "Chip.module.css"]) {
      expect(contenido(hoja)).toMatch(/min-height:\s*(4[4-9]|[5-9]\d)px/);
    }
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/componentes-reglas.test.ts`
Esperado: FALLA — el directorio no existe.

- [ ] **Paso 3: Implementar los componentes**

Portar desde el prototipo (`docs/prototipo/huellas-prototipo-v1.html`) las clases `.btn`, `.pill`, `.card`, `.chip`, `.photo` y `.photo__gate` a módulos CSS, un archivo por componente. Los valores son los aprobados: copiarlos, no reinventarlos.

`src/ui/componentes/Boton.tsx`:

```tsx
import estilos from "./Boton.module.css";

type Variante = "donar" | "primario" | "fantasma";

export function Boton({
  variante = "primario",
  tamano,
  children,
  ...resto
}: {
  variante?: Variante;
  tamano?: "sm";
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const clases = [estilos.boton, estilos[variante], tamano === "sm" ? estilos.chico : ""].join(" ");
  return (
    <button className={clases} {...resto}>
      {children}
    </button>
  );
}
```

`src/ui/componentes/CompuertaSensible.tsx` implementa la §5.11 del sistema de diseño: la foto llega difuminada, con ícono de ojo, título de qué se va a ver y aclaración. **No se recuerda entre visitas**: cada carga vuelve a difuminar.

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/componentes-reglas.test.ts`
Esperado: PASAN las 3.

- [ ] **Paso 5: Confirmar**

```bash
git add src/ui tests/unidad/componentes-reglas.test.ts
git commit -m "feat: componentes del sistema de diseño

La prueba verifica que ningún componente escriba un color literal y que
el naranja quede reservado al dinero."
```

---

## Tarea 11: Panel — alta, edición y publicación de animales

**Archivos:**
- Crear: `src/app/panel/layout.tsx`, `src/app/panel/page.tsx`, `src/app/panel/animales/page.tsx`, `src/app/panel/animales/[id]/page.tsx`, `src/app/panel/animales/acciones.ts`
- Prueba: manual (ver paso 5)

**Interfaces:**
- Consume: `crearAnimal`, `editarAnimal`, `publicarAnimal`, `cambiarEstado`, `archivarAnimal`; `auth()`; `repositorioPrisma`, `auditoriaPrisma`.
- Produce: acciones de servidor `accionCrearAnimal`, `accionEditarAnimal`, `accionPublicarAnimal`, `accionCambiarEstado`.

- [ ] **Paso 1: Cascarón del panel que exige sesión**

Crear `src/app/panel/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/infra/auth";

export const metadata = { robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) redirect("/panel/entrar");
  return <div data-panel>{children}</div>;
}
```

- [ ] **Paso 2: Acciones de servidor**

Crear `src/app/panel/animales/acciones.ts`:

```ts
"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/infra/auth";
import { prisma } from "@/infra/prisma";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearAnimal, editarAnimal, publicarAnimal } from "@/domains/animales/servicio";
import type { Contexto } from "@/domains/animales/tipos";

/** Arma el contexto de dominio para una transacción. Único punto de entrada del panel. */
async function conContexto<T>(fn: (ctx: Contexto) => Promise<T>): Promise<T> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  return prisma.$transaction(async (tx) =>
    fn({
      usuarioEmail: sesion.user.email!,
      rol: sesion.user.rol as Contexto["rol"],
      repositorio: repositorioPrisma(tx),
      auditoria: auditoriaPrisma(tx),
    })
  );
}

export async function accionCrearAnimal(formulario: FormData) {
  const animal = await conContexto((ctx) =>
    crearAnimal(
      {
        nombre: String(formulario.get("nombre") ?? ""),
        especie: formulario.get("especie") as "PERRO",
        sexo: formulario.get("sexo") as "MACHO",
        tamano: formulario.get("tamano") as "MEDIANO",
        descripcion: String(formulario.get("descripcion") ?? ""),
      },
      ctx
    )
  );
  redirect(`/panel/animales/${animal.id}`);
}

export async function accionPublicarAnimal(id: string) {
  const animal = await conContexto((ctx) => publicarAnimal(id, ctx));
  // Regenera la ficha y el listado. Sin esto, la página estática queda vieja.
  revalidateTag("animales");
  revalidateTag(`animal:${animal.slug}`);
}
```

- [ ] **Paso 3: Formulario de alta y edición**

Crear `src/app/panel/animales/[id]/page.tsx` con el formulario del sistema de diseño §5.14: **etiqueta visible siempre**, texto de ayuda debajo del campo, error junto al campo que lo produce. Campos: nombre, especie, sexo, tamaño, descripción, personalidad, zona, requisitos, castrado, vacunas.

Los campos calculados —los que aparecerán en la entrega 2— se muestran de solo lectura con ícono de candado. En esta entrega no hay ninguno todavía, pero el componente `CampoCalculado` se crea acá para que exista cuando llegue.

- [ ] **Paso 4: Listado interno**

Crear `src/app/panel/animales/page.tsx`: tabla con nombre, especie, estado, fecha de publicación y acciones. Filtro por estado. Los archivados se muestran al final, atenuados, nunca ausentes.

- [ ] **Paso 5: Verificación manual**

Ejecutar `npm run dev` y comprobar:
1. Entrar a `/panel/animales`, crear un animal → queda en borrador.
2. Publicarlo → pasa a disponible.
3. Corregirle el nombre → la dirección **no cambia**.
4. Archivarlo → desaparece del listado público pero su ficha responde.
5. Consultar `SELECT accion, entidad FROM "RegistroAuditoria" ORDER BY "creadoEn" DESC LIMIT 5` → hay una fila por cada acción.

- [ ] **Paso 6: Confirmar**

```bash
git add src/app/panel
git commit -m "feat: panel de gestión de animales"
```

---

## Tarea 12: Panel — fotos, orden y marca de sensible

**Archivos:**
- Crear: `src/app/panel/animales/[id]/fotos.tsx`, `src/app/panel/animales/[id]/acciones-fotos.ts`, `src/domains/animales/fotos.ts`
- Prueba: `tests/unidad/fotos.test.ts`

**Interfaces:**
- Consume: `procesarImagen`, `validarImagen`, `almacenLocal`.
- Produce: `agregarFoto(animalId, archivo, ctx)`, `reordenarFotos(animalId, idsEnOrden, ctx)`, `marcarSensible(fotoId, sensible, ctx)`, `definirPrincipal(fotoId, ctx)`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/fotos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ordenarTrasReordenar, elegirPrincipal } from "@/domains/animales/fotos";

const fotos = [
  { id: "a", orden: 0, principal: true },
  { id: "b", orden: 1, principal: false },
  { id: "c", orden: 2, principal: false },
];

describe("orden de fotos", () => {
  it("reasigna el orden según la lista recibida", () => {
    expect(ordenarTrasReordenar(fotos, ["c", "a", "b"])).toEqual([
      { id: "c", orden: 0 },
      { id: "a", orden: 1 },
      { id: "b", orden: 2 },
    ]);
  });

  it("rechaza una lista que no contenga exactamente las mismas fotos", () => {
    expect(() => ordenarTrasReordenar(fotos, ["a", "b"])).toThrow(/todas las fotos/i);
  });
});

describe("foto principal", () => {
  it("solo puede haber una", () => {
    const resultado = elegirPrincipal(fotos, "c");
    expect(resultado.filter((f) => f.principal)).toHaveLength(1);
    expect(resultado.find((f) => f.principal)?.id).toBe("c");
  });

  it("si no hay ninguna marcada, la primera es la principal", () => {
    const sinPrincipal = fotos.map((f) => ({ ...f, principal: false }));
    expect(elegirPrincipal(sinPrincipal, null)[0].principal).toBe(true);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/fotos.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/animales/fotos.ts`:

```ts
interface FotoOrdenable { id: string; orden: number; principal: boolean }

export function ordenarTrasReordenar(
  fotos: FotoOrdenable[],
  idsEnOrden: string[]
): Array<{ id: string; orden: number }> {
  const existentes = new Set(fotos.map((f) => f.id));
  const recibidos = new Set(idsEnOrden);
  if (existentes.size !== recibidos.size || [...existentes].some((id) => !recibidos.has(id))) {
    throw new Error("El nuevo orden tiene que incluir todas las fotos, exactamente una vez");
  }
  return idsEnOrden.map((id, orden) => ({ id, orden }));
}

export function elegirPrincipal(fotos: FotoOrdenable[], idPrincipal: string | null): FotoOrdenable[] {
  const objetivo = idPrincipal ?? fotos[0]?.id;
  return fotos.map((f) => ({ ...f, principal: f.id === objetivo }));
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/fotos.test.ts`
Esperado: PASAN las 4.

- [ ] **Paso 5: Acción de subida**

Crear `src/app/panel/animales/[id]/acciones-fotos.ts`:

```ts
"use server";

import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { auth } from "@/infra/auth";
import { prisma } from "@/infra/prisma";
import { almacenLocal } from "@/infra/almacen/local";
import { validarImagen, TAMANO_MAXIMO_BYTES } from "@/infra/imagenes/validar";
import { procesarImagen } from "@/infra/imagenes/procesar";
import { puede } from "@/domains/usuarios/autorizacion";
import type { Rol } from "@/domains/usuarios/autorizacion";

export async function accionSubirFoto(animalId: string, formulario: FormData) {
  const sesion = await auth();
  if (!sesion?.user?.rol || !puede(sesion.user.rol as Rol, "animales.escribir")) {
    throw new Error("No tenés permiso para subir fotos");
  }

  const archivo = formulario.get("archivo");
  const alt = String(formulario.get("alt") ?? "").trim();
  if (!(archivo instanceof File)) throw new Error("Falta el archivo");
  if (alt.length === 0) {
    throw new Error("Escribí una descripción de la foto: sin ella, quien no ve la imagen no sabe qué muestra");
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    throw new Error("La foto pesa más de 12 MB. Sacale peso antes de subirla.");
  }

  const datos = Buffer.from(await archivo.arrayBuffer());
  await validarImagen(datos); // por contenido real, no por extensión
  const procesada = await procesarImagen(datos);

  const almacen = almacenLocal();
  const base = `animales/${animalId}/${randomUUID()}`;
  for (const medida of procesada.medidas) {
    await almacen.guardar(`${base}-${medida.ancho}.webp`, medida.datos, "image/webp");
  }

  const cantidad = await prisma.fotoAnimal.count({ where: { animalId } });
  await prisma.fotoAnimal.create({
    data: {
      animalId,
      claveArchivo: base, // sin ancho ni extensión: el componente arma cada medida
      alt,
      orden: cantidad,
      principal: cantidad === 0,
      sensible: formulario.get("sensible") === "on",
      ancho: procesada.ancho,
      alto: procesada.alto,
      placeholder: procesada.placeholder,
    },
  });

  revalidateTag("animales");
}
```

El original **no se guarda**: solo las cuatro medidas en WebP.

**El campo `alt` no puede quedar vacío:** el formulario lo exige antes de aceptar la subida. Una foto sin texto alternativo incumple la §9 del sistema de diseño.

La casilla "esta imagen puede impresionar" escribe `sensible: true`.

- [ ] **Paso 6: Verificación manual**

Subir una foto, reordenarla arrastrando, marcarla como principal y marcarla como sensible. Comprobar en `almacenamiento/` que se generaron los cuatro anchos y que **no** está el archivo original.

- [ ] **Paso 7: Confirmar**

```bash
git add src/domains/animales/fotos.ts src/app/panel tests/unidad/fotos.test.ts
git commit -m "feat: gestión de fotos con orden, principal y marca de sensible"
```

---

## Tarea 13: Páginas públicas — listado con filtros y ficha permanente

**Archivos:**
- Crear: `src/app/adopcion/page.tsx`, `src/app/adopcion/[slug]/page.tsx`, `src/app/page.tsx`
- Crear: `src/domains/animales/consultas.ts`
- Prueba: `tests/unidad/filtros.test.ts`

**Interfaces:**
- Consume: `repositorioPrisma`, tipos del dominio.
- Produce: `animalesPublicados(filtro)`, `animalPorSlug(slug)` — ambas con caché etiquetada.

- [ ] **Paso 1: Escribir la prueba de los filtros**

Crear `tests/unidad/filtros.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filtroDesdeParametros } from "@/domains/animales/consultas";

describe("filtroDesdeParametros", () => {
  it("traduce los parámetros de la dirección", () => {
    expect(filtroDesdeParametros({ tamano: "pequeno", especie: "gato" })).toEqual({
      tamano: "PEQUENO",
      especie: "GATO",
      soloPublicados: true,
    });
  });

  it("ignora valores que no existen en lugar de romper", () => {
    expect(filtroDesdeParametros({ tamano: "gigante" })).toEqual({ soloPublicados: true });
  });

  it("sin parámetros devuelve solo los publicados", () => {
    expect(filtroDesdeParametros({})).toEqual({ soloPublicados: true });
  });
});
```

Un filtro inválido en la URL no puede romper la página: el enlace puede venir de cualquier lado.

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/filtros.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar las consultas**

Crear `src/domains/animales/consultas.ts`:

```ts
import { unstable_cache } from "next/cache";
import { repositorioPrisma } from "@/infra/repositorios/animales";
import type { Animal, FiltroAnimales } from "./tipos";

const TAMANOS = { pequeno: "PEQUENO", mediano: "MEDIANO", grande: "GRANDE" } as const;
const ESPECIES = { perro: "PERRO", gato: "GATO", otro: "OTRO" } as const;

export function filtroDesdeParametros(params: Record<string, string | undefined>): FiltroAnimales {
  const filtro: FiltroAnimales = { soloPublicados: true };
  const tamano = TAMANOS[params.tamano as keyof typeof TAMANOS];
  const especie = ESPECIES[params.especie as keyof typeof ESPECIES];
  if (tamano) filtro.tamano = tamano;
  if (especie) filtro.especie = especie;
  return filtro;
}

export const animalesPublicados = unstable_cache(
  async (filtro: FiltroAnimales): Promise<Animal[]> => repositorioPrisma().listar(filtro),
  ["animales-publicados"],
  { tags: ["animales"] }
);

export const animalPorSlug = unstable_cache(
  async (slug: string): Promise<Animal | null> => repositorioPrisma().porSlug(slug),
  ["animal-por-slug"],
  { tags: ["animales"] }
);
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/filtros.test.ts`
Esperado: PASAN las 3.

- [ ] **Paso 5: Construir el listado**

Crear `src/app/adopcion/page.tsx` siguiendo el patrón del prototipo: chips de filtro (tamaño, especie, estado) que se comunican con `aria-pressed`, grilla de tarjetas y estado vacío con texto útil. Los filtros viajan en la dirección, no en el estado del componente: así el enlace filtrado se puede compartir.

- [ ] **Paso 6: Construir la ficha**

Crear `src/app/adopcion/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { animalPorSlug } from "@/domains/animales/consultas";

export async function generateStaticParams() {
  const { animalesPublicados } = await import("@/domains/animales/consultas");
  const animales = await animalesPublicados({ soloPublicados: true });
  return animales.map((a) => ({ slug: a.slug }));
}

export default async function FichaAnimal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const animal = await animalPorSlug(slug);
  if (!animal) notFound();
  // Un animal adoptado o archivado SIGUE mostrando su ficha: los enlaces que
  // circularon por Facebook tienen que seguir funcionando (spec de diseño §6.2).
  return <article>{/* galería, datos, personalidad, salud, requisitos, compartir */}</article>;
}
```

La ficha muestra el sello **Adoptada** cuando corresponde, con el verde de marca — nunca el naranja.

- [ ] **Paso 7: Verificación manual**

Publicar dos animales de distinto tamaño y comprobar: el listado los muestra, los filtros funcionan y se pueden compartir por URL, la ficha responde, y la ficha de un adoptado sigue accesible.

- [ ] **Paso 8: Confirmar**

```bash
git add src/app/adopcion src/app/page.tsx src/domains/animales/consultas.ts tests/unidad/filtros.test.ts
git commit -m "feat: listado con filtros y ficha permanente de animales"
```

---

## Tarea 14: SEO, compartir y redirecciones permanentes

**Archivos:**
- Crear: `src/app/adopcion/[slug]/opengraph-image.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/middleware.ts`
- Modificar: `src/app/adopcion/[slug]/page.tsx` (metadatos)
- Prueba: `tests/unidad/metadatos.test.ts`, `tests/integracion/redirecciones.test.ts`

**Interfaces:**
- Consume: `animalPorSlug`, `animalesPublicados`.
- Produce: `metadatosDeAnimal(animal)` — título, descripción, canónica y Open Graph.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/metadatos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { metadatosDeAnimal } from "@/domains/animales/metadatos";

const animal = {
  id: "1", slug: "juanito", nombre: "Juanito", especie: "PERRO" as const, sexo: "MACHO" as const,
  tamano: "MEDIANO" as const, descripcion: "Lo encontraron atado a un poste en barrio Tablada. Hoy pesa 18 kilos.",
  estado: "DISPONIBLE" as const, archivado: false, publicadoEn: new Date(), atributos: {},
};

describe("metadatosDeAnimal", () => {
  it("arma un título único y descriptivo", () => {
    expect(metadatosDeAnimal(animal).title).toBe("Juanito — Perro en adopción");
  });

  it("dice que fue adoptado cuando corresponde", () => {
    expect(metadatosDeAnimal({ ...animal, estado: "ADOPTADO" }).title).toBe("Juanito — Adoptado");
  });

  it("recorta la descripción sin cortar una palabra al medio", () => {
    const desc = metadatosDeAnimal(animal).description!;
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(desc.endsWith(" …")).toBe(false);
  });

  it("declara la dirección canónica", () => {
    expect(metadatosDeAnimal(animal).alternates?.canonical).toBe("/adopcion/juanito");
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/metadatos.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar los metadatos**

Crear `src/domains/animales/metadatos.ts`:

```ts
import type { Metadata } from "next";
import type { Animal } from "./tipos";

const ESPECIE_EN_TEXTO = { PERRO: "Perro", GATO: "Gato", OTRO: "Animal" } as const;

function recortar(texto: string, maximo = 160): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.lastIndexOf(" ", maximo - 1);
  return `${texto.slice(0, corte > 0 ? corte : maximo - 1)}…`;
}

export function metadatosDeAnimal(animal: Animal): Metadata {
  const titulo =
    animal.estado === "ADOPTADO"
      ? `${animal.nombre} — Adoptado`
      : `${animal.nombre} — ${ESPECIE_EN_TEXTO[animal.especie]} en adopción`;

  return {
    title: titulo,
    description: recortar(animal.descripcion),
    alternates: { canonical: `/adopcion/${animal.slug}` },
    openGraph: {
      title: titulo,
      description: recortar(animal.descripcion),
      url: `/adopcion/${animal.slug}`,
      type: "article",
    },
  };
}
```

Conectarlo en la ficha con `export async function generateMetadata({ params })`.

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/metadatos.test.ts`
Esperado: PASAN las 4.

- [ ] **Paso 5: Imagen de vista previa social**

Crear `src/app/adopcion/[slug]/opengraph-image.tsx` con `ImageResponse`, tamaño 1200×630: foto principal, nombre en grande y el nombre de la asociación. Es lo que Facebook muestra cuando alguien comparte el enlace; sin esto, el enlace se ve pelado y no se hace clic.

- [ ] **Paso 6: Mapa del sitio y robots**

Crear `src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { animalesPublicados } from "@/domains/animales/consultas";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000";
  const animales = await animalesPublicados({ soloPublicados: true });

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/adopcion`, changeFrequency: "daily", priority: 0.9 },
    ...animales.map((a) => ({
      url: `${base}/adopcion/${a.slug}`,
      lastModified: a.publicadoEn ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
```

Crear `src/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/api"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
```

- [ ] **Paso 7: Redirecciones de direcciones viejas**

Crear `src/app/adopcion/[slug]/not-found.tsx` no alcanza: la redirección tiene que responder con código 308 para que los buscadores y Facebook la sigan. Como el middleware de Next.js no puede consultar Prisma, la búsqueda va en la propia página, antes del `notFound()`.

Modificar `src/app/adopcion/[slug]/page.tsx`:

```tsx
import { notFound, permanentRedirect } from "next/navigation";
import { animalPorSlug, slugActualDe } from "@/domains/animales/consultas";

export default async function FichaAnimal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const animal = await animalPorSlug(slug);

  if (!animal) {
    // Una dirección que circuló por Facebook nunca puede terminar en 404.
    const actual = await slugActualDe(slug);
    if (actual) permanentRedirect(`/adopcion/${actual}`);
    notFound();
  }
  // ...
}
```

Agregar a `src/domains/animales/consultas.ts`:

```ts
export const slugActualDe = unstable_cache(
  async (slugAnterior: string): Promise<string | null> => {
    const redireccion = await prisma.redireccionDireccion.findUnique({ where: { slugAnterior } });
    if (!redireccion?.animalId) return null;
    const animal = await repositorioPrisma().porId(redireccion.animalId);
    return animal?.slug ?? null;
  },
  ["slug-actual"],
  { tags: ["animales"] }
);
```

Crear la prueba `tests/integracion/redirecciones.test.ts`: insertar un animal, insertar una fila en `RedireccionDireccion` apuntando a él desde un slug viejo, y verificar que `slugActualDe("slug-viejo")` devuelve el slug actual, y que devuelve `null` para uno que no existe.

- [ ] **Paso 8: Verificación manual del compartido**

Publicar la aplicación en un entorno accesible y pegar el enlace de un animal en el depurador de Facebook (`developers.facebook.com/tools/debug`). Verificar que aparecen título, descripción e imagen.

- [ ] **Paso 9: Confirmar**

```bash
git add src/app src/domains/animales/metadatos.ts src/middleware.ts tests
git commit -m "feat: SEO, imagen de vista previa social y redirecciones permanentes"
```

---

## Tarea 15: Pruebas de las invariantes

Esta tarea no agrega funcionalidad: reúne en un solo archivo las pruebas que verifican **lo que el sistema no puede hacer**. Son las que protegen la promesa de la plataforma.

**Archivos:**
- Crear: `tests/unidad/invariantes.test.ts`
- Modificar: `package.json`

**Interfaces:**
- Consume: todo lo anterior.
- Produce: `npm run test:invariantes`.

- [ ] **Paso 1: Escribir las pruebas**

Crear `tests/unidad/invariantes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { crearAnimal, editarAnimal } from "@/domains/animales/servicio";
import { repositorioEnMemoria, auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

function archivosDe(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => path.join(dir, f));
}

describe("invariantes de la plataforma", () => {
  it("ninguna página ni componente importa Prisma directamente", () => {
    const infractores = archivosDe("src/app")
      .filter((f) => !f.includes("acciones"))
      .filter((f) => /from ["']@prisma\/client["']|@\/infra\/prisma/.test(readFileSync(f, "utf8")));
    expect(infractores, `Estos archivos saltean la capa de dominio: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("la dirección de un animal no cambia nunca", async () => {
    const ctx = {
      usuarioEmail: "a@b.c", rol: "ANIMALES" as const,
      repositorio: repositorioEnMemoria(), auditoria: auditoriaEnMemoria(),
    };
    const animal = await crearAnimal(
      { nombre: "Luna", especie: "PERRO", sexo: "HEMBRA", tamano: "GRANDE", descripcion: "Descripción suficientemente larga para publicar." },
      ctx
    );
    const editado = await editarAnimal(animal.id, { slug: "otra-cosa" } as never, ctx);
    expect(editado.slug).toBe("luna");
  });

  it("ningún rol tiene una acción para escribir el total recaudado", () => {
    const autorizacion = readFileSync("src/domains/usuarios/autorizacion.ts", "utf8");
    expect(autorizacion).not.toMatch(/recaudado|saldo/i);
  });

  it("el esquema declara los importes como BigInt, nunca como Float", () => {
    const esquema = readFileSync("prisma/schema.prisma", "utf8");
    expect(esquema).not.toMatch(/Float/);
    expect(esquema).toMatch(/metaCentavos\s+BigInt/);
  });

  it("la migración del disparador de inmutabilidad existe", () => {
    const migraciones = readdirSync("prisma/migrations");
    const inmutable = migraciones.find((m) => m.includes("asientos_inmutables"));
    expect(inmutable).toBeDefined();
    const sql = readFileSync(path.join("prisma/migrations", inmutable!, "migration.sql"), "utf8");
    expect(sql).toMatch(/BEFORE UPDATE ON "AsientoContable"/);
    expect(sql).toMatch(/BEFORE DELETE ON "AsientoContable"/);
  });
});
```

- [ ] **Paso 2: Ejecutar**

Ejecutar: `npx vitest run tests/unidad/invariantes.test.ts`
Esperado: PASAN las 5. Si alguna falla, **no se arregla la prueba**: se arregla el código. Cada una de estas pruebas representa una puerta que no debe existir.

- [ ] **Paso 3: Agregar el atajo**

En `package.json`:

```json
"test:invariantes": "vitest run tests/unidad/invariantes.test.ts"
```

- [ ] **Paso 4: Confirmar**

```bash
git add tests/unidad/invariantes.test.ts package.json
git commit -m "test: invariantes que protegen la promesa de la plataforma

Verifican lo que el sistema NO puede hacer: saltear la capa de dominio,
cambiar una dirección permanente, escribir un total recaudado, guardar
importes como decimales o quedarse sin el disparador de inmutabilidad."
```

---

## Tarea 16: Despliegue y copias de seguridad

**Archivos:**
- Crear: `.github/workflows/pruebas.yml`, `docs/operacion.md`
- Modificar: `README.md`

- [ ] **Paso 1: Integración continua**

Crear `.github/workflows/pruebas.yml` que en cada empuje instale dependencias, genere el cliente Prisma y ejecute `npm test`. Las pruebas de integración corren solo si el secreto `DATABASE_URL_TEST` está definido.

- [ ] **Paso 2: Documentar la operación**

Crear `docs/operacion.md` con: cómo dar de alta a una persona en el panel, cómo hacer una copia de seguridad de la base y del almacén, y la tabla de la spec §9 sobre qué cambia si aparece presupuesto.

- [ ] **Paso 3: Actualizar el README**

Instalación, variables de entorno, cómo correr las pruebas, y los enlaces a las tres specs.

- [ ] **Paso 4: Confirmar**

```bash
git add .github docs/operacion.md README.md
git commit -m "chore: integración continua, documentación de operación y copias de seguridad"
```

---

## Cobertura de la especificación

| Requisito de la spec | Tarea |
|---|---|
| §3 Arquitectura de tres capas | 1, 5, 7 |
| §4 Modelo de datos completo | 2 |
| §4.1 Importes en centavos | 2, 15 |
| §4.1 Libro contable inmutable | 3, 15 |
| §4.1 Nada se borra, dirección permanente | 6, 15 |
| §4.1 Redirecciones de direcciones viejas | 14 |
| §5 Pipeline de imágenes y validación real | 9, 12 |
| §6 Renderizado estático y revalidación | 11, 13 |
| §6 SEO, Open Graph, sitemap | 14 |
| §7 Acceso con Google y lista de autorizados | 8 |
| §7 Permisos en el dominio | 5, 8 |
| §7 Auditoría transaccional | 5, 7 |
| §8 Pruebas de invariantes | 15 |
| §9 Portabilidad y copias de seguridad | 16 |
| Diseño §2 Tres estados de tema | 1 |
| Diseño §3 Naranja solo para dinero | 10 |
| Diseño §5.11 Compuerta de imagen sensible | 10, 12 |
| Diseño §9 Accesibilidad | 10, 12 |

## Fuera de alcance de esta entrega

Casos financieros y su interfaz pública, integración con Mercado Pago y webhooks, transparencia pública, postulaciones de adopción, documentos de respaldo, y notificaciones. Sus tablas existen en el modelo desde la tarea 2; sus reglas se implementan en las entregas 2, 3 y 4.
