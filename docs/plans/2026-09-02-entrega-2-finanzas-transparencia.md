# Entrega 2 — Finanzas y transparencia: Plan de implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Que cualquiera pueda seguir el recorrido completo de un peso donado: entró, se gastó, acá está el comprobante, este es el saldo.

**Arquitectura:** Se sigue el patrón ya establecido en la entrega 1. El dominio `finanzas` depende de puertos (`RepositorioFinanzas`, `PuertoAuditoria`, `ProveedorDePagos`), nunca de Prisma ni de Mercado Pago, así que sus pruebas corren en memoria. Los saldos del caso son derivados: se recalculan desde la suma de asientos dentro de la misma transacción que inserta el asiento. Las páginas públicas se generan estáticas y se revalidan por etiqueta al registrar cada movimiento.

**Stack:** El de la entrega 1 (Next.js 15, React 19, TypeScript estricto, PostgreSQL + Prisma 6, Auth.js v5, Vitest) más el SDK de Mercado Pago para la mitad 2B.

**Spec:** [docs/specs/2026-09-02-entrega-2-finanzas-transparencia-design.md](../specs/2026-09-02-entrega-2-finanzas-transparencia-design.md)
**Entrega 1:** [docs/specs/2026-09-02-entrega-1-nucleo-adopcion-design.md](../specs/2026-09-02-entrega-1-nucleo-adopcion-design.md)
**Sistema de diseño:** [docs/specs/2026-09-02-sistema-diseno-v1.md](../specs/2026-09-02-sistema-diseno-v1.md)

## Restricciones globales

Aplican a **todas** las tareas. Copiadas de las especificaciones.

- **Las páginas y los componentes nunca acceden a la base de datos directamente.** Toda lectura y escritura pasa por una función de dominio.
- **Los importes son enteros en centavos (`BigInt`), nunca decimales de punto flotante.** Signo positivo entra, negativo sale.
- **El libro contable es solo de agregado.** Un asiento no se modifica ni se borra: una corrección es un asiento nuevo de tipo `AJUSTE` que apunta al original. El disparador de la base lo hace cumplir.
- **Los saldos del caso solo los escribe el dominio `finanzas`**, en la misma transacción que inserta el asiento.
- **Lo pendiente de verificación nunca suma al total público.**
- **El aviso del proveedor no se cree nunca:** aporta el número de pago, el estado se consulta contra la API con nuestro token.
- **Los permisos se verifican en la capa de dominio, no escondiendo botones.** Solo `ADMINISTRACION` y `FINANZAS` escriben dinero.
- **La auditoría se escribe en la misma transacción que la acción.**
- **El naranja es solo para el dinero.** El resto de la interfaz usa el verde de marca.
- **Ningún comprobante publicado muestra datos personales de nadie.** El panel exige confirmar el tachado antes de marcarlo público; sin esa confirmación queda privado.
- **Idioma:** todo en castellano rioplatense — código, nombres, comentarios, commits y pantallas.
- TypeScript estricto. Sin `any` salvo con comentario que lo justifique.

## Las dos mitades

**2A — El libro (tareas 1 a 11).** Casos, asientos, gastos, transferencias verificadas a mano, páginas públicas y panel. Al terminar, la asociación ya puede rendir cuentas en público cargando los movimientos a mano.

**2B — Los pagos (tareas 12 a 17).** Mercado Pago. La 2A no depende de la 2B: si la habilitación de la cuenta se demora, la transparencia ya está en línea.

---

## Estructura de archivos

```
prisma/
  schema.prisma                          + IntencionDonacion, Documento, cambios a AsientoContable
  migrations/                            + migración de la entrega 2
src/
  domains/finanzas/
    tipos.ts                             Tipos del dominio y puertos
    esquemas.ts                          Validación con zod
    dinero.ts                            Formato y signo de los importes
    casos.ts                             Crear, editar, cerrar un caso
    asientos.ts                          registrarAsiento: la operación central
    donaciones.ts                        Intenciones, verificación de transferencias
    ajustes.ts                           Ajustes y traslados entre casos
    consultas.ts                         Lecturas públicas, con caché por etiqueta
  domains/pagos/
    tipos.ts                             ProveedorDePagos (puerto)
    procesar-aviso.ts                    Idempotencia en dos capas y verificación
  infra/
    repositorios/finanzas.ts             Implementación Prisma del puerto
    pagos/mercadopago.ts                 Adaptador del proveedor
    pagos/firma.ts                       Validación de la firma del aviso
  app/
    ayudar/page.tsx                      Listado de casos
    ayudar/[slug]/page.tsx               Caso: dirección permanente
    ayudar/[slug]/opengraph-image.tsx
    ayudar/[slug]/Pestanas.tsx           Resumen, gastos, libro, novedades
    ayudar/[slug]/donar/page.tsx         Formulario de donación
    transparencia/page.tsx
    api/webhooks/mercadopago/route.ts
    panel/(protegido)/finanzas/…         Casos, gastos, transferencias, ajustes
  ui/finanzas/
    Importe.tsx                          Importe con signo y color contable
    Medidor.tsx                          Barra de recaudación
    LibroContable.tsx                    Filas del libro
tests/
  unidad/finanzas-*.test.ts
  unidad/pagos-*.test.ts
  dobles/repositorio-finanzas-memoria.ts
  dobles/proveedor-pagos-falso.ts
  integracion/finanzas-*.test.ts
```

---

# Mitad 2A — El libro

## Tarea 1: Modelo de datos de la entrega 2

**Archivos:**
- Modificar: `prisma/schema.prisma`
- Crear: `prisma/migrations/<fecha>_entrega_2/migration.sql` (generada)
- Prueba: `tests/integracion/finanzas-modelo.test.ts`

**Interfaces:**
- Consume: el esquema de la entrega 1.
- Produce: modelos `IntencionDonacion`, `Documento`; campos `intencionId` y `contraparteId` en `AsientoContable`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/integracion/finanzas-modelo.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const casos: string[] = [];

afterAll(async () => {
  await prisma.asientoContable.deleteMany({ where: { casoId: { in: casos } } });
  await prisma.intencionDonacion.deleteMany({ where: { casoId: { in: casos } } });
  await prisma.casoFinanciero.deleteMany({ where: { id: { in: casos } } });
  await prisma.$disconnect();
});

async function casoDePrueba() {
  const caso = await prisma.casoFinanciero.create({
    data: { slug: `caso-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, titulo: "Prueba", situacion: "x", metaCentavos: 100000n },
  });
  casos.push(caso.id);
  return caso;
}

describe("modelo de la entrega 2", () => {
  it("guarda una intención de donación con la preferencia de anonimato", async () => {
    const caso = await casoDePrueba();
    const intencion = await prisma.intencionDonacion.create({
      data: { casoId: caso.id, centavos: 5000n, proveedor: "mercadopago", nombreDonante: "Marina", publicarNombre: true },
    });
    expect(intencion.estado).toBe("INICIADA");
    expect(intencion.publicarNombre).toBe(true);
  });

  it("una intención produce a lo sumo un asiento", async () => {
    const caso = await casoDePrueba();
    const intencion = await prisma.intencionDonacion.create({
      data: { casoId: caso.id, centavos: 5000n, proveedor: "mercadopago" },
    });
    await prisma.asientoContable.create({
      data: { casoId: caso.id, tipo: "DONACION", centavos: 5000n, descripcion: "Donación", fechaEfectiva: new Date(), intencionId: intencion.id },
    });
    await expect(
      prisma.asientoContable.create({
        data: { casoId: caso.id, tipo: "DONACION", centavos: 5000n, descripcion: "Duplicada", fechaEfectiva: new Date(), intencionId: intencion.id },
      })
    ).rejects.toThrow();
  });

  it("no admite dos asientos para el mismo pago del mismo proveedor", async () => {
    const caso = await casoDePrueba();
    const pago = `pago-${Date.now()}`;
    await prisma.asientoContable.create({
      data: { casoId: caso.id, tipo: "DONACION", centavos: 5000n, descripcion: "Donación", fechaEfectiva: new Date(), proveedor: "mercadopago", pagoExternoId: pago },
    });
    await expect(
      prisma.asientoContable.create({
        data: { casoId: caso.id, tipo: "DONACION", centavos: 5000n, descripcion: "Repetida", fechaEfectiva: new Date(), proveedor: "mercadopago", pagoExternoId: pago },
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/integracion/finanzas-modelo.test.ts`
Esperado: FALLA — `prisma.intencionDonacion` no existe.

- [ ] **Paso 3: Agregar los modelos**

En `prisma/schema.prisma`, copiar los bloques de la §3.1 y §3.2 de la especificación. Además:

```prisma
model Documento {
  id                 String   @id @default(cuid())
  claveArchivo       String
  nombre             String
  tipo               String   // "factura" | "recibo" | "comprobante" | "acta" | "otro"
  publico            Boolean  @default(false)
  // La §11 del sistema de diseño: sin esta confirmación explícita, el
  // documento no puede marcarse público.
  datosPersonalesTachados Boolean @default(false)
  subidoPorEmail     String
  creadoEn           DateTime @default(now())
}
```

En `CasoFinanciero`, agregar la relación inversa `intenciones IntencionDonacion[]`.

- [ ] **Paso 4: Generar y aplicar la migración**

```bash
npx prisma migrate dev --name entrega_2_finanzas
```

- [ ] **Paso 5: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/integracion/finanzas-modelo.test.ts`
Esperado: PASAN las 3.

- [ ] **Paso 6: Confirmar**

```bash
git add prisma tests/integracion/finanzas-modelo.test.ts
git commit -m "feat: modelo de intenciones de donación y documentos

La intención se registra antes de pagar porque el aviso del proveedor no
trae la preferencia de anonimato: allá nunca se preguntó."
```

---

## Tarea 2: Dinero — formato y signo

**Archivos:**
- Crear: `src/domains/finanzas/dinero.ts`
- Prueba: `tests/unidad/finanzas-dinero.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: `formatearCentavos(centavos: bigint): string`, `esIngreso(centavos: bigint): boolean`, `sumarCentavos(valores: bigint[]): bigint`, `separarPorSigno(valores: bigint[]): { entradas: bigint; salidas: bigint }`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/finanzas-dinero.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatearCentavos, esIngreso, sumarCentavos, separarPorSigno } from "@/domains/finanzas/dinero";

describe("formatearCentavos", () => {
  it("usa el formato argentino, con punto de miles", () => {
    expect(formatearCentavos(32750000n)).toBe("$327.500");
  });

  it("muestra los centavos solo cuando los hay", () => {
    expect(formatearCentavos(150050n)).toBe("$1.500,50");
    expect(formatearCentavos(150000n)).toBe("$1.500");
  });

  it("un egreso se muestra en positivo: el signo lo pone la interfaz", () => {
    expect(formatearCentavos(-8000000n)).toBe("$80.000");
  });

  it("el cero es cero, no vacío", () => {
    expect(formatearCentavos(0n)).toBe("$0");
  });
});

describe("signo de los movimientos", () => {
  it("positivo entra, negativo sale", () => {
    expect(esIngreso(5000n)).toBe(true);
    expect(esIngreso(-5000n)).toBe(false);
  });

  it("suma sin perder precisión en montos grandes", () => {
    // Con decimales de punto flotante esta suma daría 8943199.999999999
    expect(sumarCentavos([894319900n, 100n])).toBe(894320000n);
  });

  it("separa entradas de salidas y devuelve las salidas en positivo", () => {
    expect(separarPorSigno([10000n, -3000n, 5000n, -2000n])).toEqual({ entradas: 15000n, salidas: 5000n });
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/finanzas-dinero.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/finanzas/dinero.ts`:

```ts
/**
 * Los importes son enteros en centavos. Nunca decimales de punto flotante:
 * producen errores de redondeo que después aparecen como diferencias de un
 * peso en el balance público, y en una plataforma cuyo argumento es la
 * verificabilidad, un peso de diferencia destruye el argumento entero.
 */

const FORMATO_SIN_CENTAVOS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const FORMATO_CON_CENTAVOS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** El signo lo pone la interfaz, con color y símbolo. Acá siempre en positivo. */
export function formatearCentavos(centavos: bigint): string {
  const absoluto = centavos < 0n ? -centavos : centavos;
  const enPesos = Number(absoluto) / 100;
  const formato = absoluto % 100n === 0n ? FORMATO_SIN_CENTAVOS : FORMATO_CON_CENTAVOS;
  // Intl deja un espacio no separable después del símbolo; se saca para que
  // el importe ocupe menos en pantallas angostas.
  return formato.format(enPesos).replace(/\s/g, "");
}

export function esIngreso(centavos: bigint): boolean {
  return centavos > 0n;
}

export function sumarCentavos(valores: bigint[]): bigint {
  return valores.reduce((total, valor) => total + valor, 0n);
}

export function separarPorSigno(valores: bigint[]): { entradas: bigint; salidas: bigint } {
  let entradas = 0n;
  let salidas = 0n;
  for (const valor of valores) {
    if (valor > 0n) entradas += valor;
    else salidas += -valor;
  }
  return { entradas, salidas };
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/finanzas-dinero.test.ts`
Esperado: PASAN las 7. Si el formato del símbolo difiere según la versión de Node, ajustar el `replace` — no la expectativa de la prueba.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/finanzas/dinero.ts tests/unidad/finanzas-dinero.test.ts
git commit -m "feat: manejo de importes en centavos enteros"
```

---

## Tarea 3: Tipos y puertos del dominio finanzas

**Archivos:**
- Crear: `src/domains/finanzas/tipos.ts`, `src/domains/finanzas/esquemas.ts`
- Crear: `tests/dobles/repositorio-finanzas-memoria.ts`

**Interfaces:**
- Consume: `PuertoAuditoria` de `@/domains/animales/tipos`.
- Produce: `Caso`, `Asiento`, `Intencion`, `RepositorioFinanzas`, `ContextoFinanzas`, `esquemaCaso`, `esquemaAsiento`.

- [ ] **Paso 1: Definir los tipos**

Crear `src/domains/finanzas/tipos.ts`:

```ts
import type { PuertoAuditoria } from "@/domains/animales/tipos";

export type TipoAsiento = "DONACION" | "GASTO" | "REEMBOLSO" | "TRANSFERENCIA" | "AJUSTE";
export type EstadoCaso = "ABIERTO" | "META_ALCANZADA" | "CERRADO";
export type EstadoIntencion = "INICIADA" | "PENDIENTE_VERIFICACION" | "APROBADA" | "RECHAZADA" | "ABANDONADA";
export type Rol = "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";

export interface Caso {
  id: string;
  slug: string;
  animalId: string | null;
  titulo: string;
  situacion: string;
  metaCentavos: bigint;
  moneda: string;
  estado: EstadoCaso;
  recibidoCentavos: bigint;
  gastadoCentavos: bigint;
  cantidadDonantes: number;
  creadoEn: Date;
}

export interface Asiento {
  id: string;
  casoId: string;
  tipo: TipoAsiento;
  centavos: bigint;
  moneda: string;
  descripcion: string;
  proveedor: string | null;
  pagoExternoId: string | null;
  ajustaAId: string | null;
  contraparteId: string | null;
  documentoId: string | null;
  intencionId: string | null;
  creadoPorId: string | null;
  creadoPorSistema: boolean;
  fechaEfectiva: Date;
  creadoEn: Date;
}

export interface Intencion {
  id: string;
  casoId: string;
  centavos: bigint;
  moneda: string;
  nombreDonante: string | null;
  publicarNombre: boolean;
  mensaje: string | null;
  proveedor: string;
  estado: EstadoIntencion;
  referenciaExterna: string | null;
  pagoExternoId: string | null;
  comprobanteId: string | null;
  creadoEn: Date;
  resueltoEn: Date | null;
}

/** Lo que la suma de asientos dice sobre un caso. */
export interface SaldoDelCaso {
  recibidoCentavos: bigint;
  gastadoCentavos: bigint;
  cantidadDonaciones: number;
}

export interface FiltroCasos {
  estado?: EstadoCaso;
  soloAbiertos?: boolean;
}

export interface RepositorioFinanzas {
  crearCaso(datos: Omit<Caso, "id" | "creadoEn">): Promise<Caso>;
  actualizarCaso(id: string, cambios: Partial<Caso>): Promise<Caso>;
  casoPorId(id: string): Promise<Caso | null>;
  casoPorSlug(slug: string): Promise<Caso | null>;
  slugsDeCasos(): Promise<string[]>;
  listarCasos(filtro: FiltroCasos): Promise<Caso[]>;

  crearAsiento(datos: Omit<Asiento, "id" | "creadoEn">): Promise<Asiento>;
  asientosDeCaso(casoId: string): Promise<Asiento[]>;
  /** Recalcula desde los asientos. No lee los campos derivados del caso. */
  saldoDeCaso(casoId: string): Promise<SaldoDelCaso>;
  asientoPorPagoExterno(proveedor: string, pagoExternoId: string): Promise<Asiento | null>;

  crearIntencion(datos: Omit<Intencion, "id" | "creadoEn" | "resueltoEn">): Promise<Intencion>;
  intencionPorId(id: string): Promise<Intencion | null>;
  actualizarIntencion(id: string, cambios: Partial<Intencion>): Promise<Intencion>;
  intencionesPendientes(): Promise<Intencion[]>;
}

export interface ContextoFinanzas {
  usuarioEmail: string;
  rol: Rol;
  repositorio: RepositorioFinanzas;
  auditoria: PuertoAuditoria;
}
```

- [ ] **Paso 2: Definir la validación**

Crear `src/domains/finanzas/esquemas.ts`:

```ts
import { z } from "zod";

export const esquemaCaso = z.object({
  titulo: z.string().trim().min(1, "El caso necesita un título").max(120),
  situacion: z.string().trim().min(20, "Contá qué le pasó al animal: es lo primero que lee quien llega desde Facebook"),
  metaCentavos: z.bigint().positive("La meta tiene que ser mayor que cero"),
  animalId: z.string().nullable().default(null),
  moneda: z.string().default("ARS"),
});

export const esquemaGasto = z.object({
  casoId: z.string().min(1),
  centavos: z.bigint().positive("El importe del gasto tiene que ser mayor que cero"),
  descripcion: z.string().trim().min(3, "Describí en qué se gastó"),
  documentoId: z.string().nullable().default(null),
  fechaEfectiva: z.date(),
});

export const esquemaAjuste = z.object({
  casoId: z.string().min(1),
  centavos: z.bigint(),
  ajustaAId: z.string().min(1, "Un ajuste tiene que apuntar al asiento que corrige"),
  motivo: z.string().trim().min(10, "El motivo del ajuste queda publicado: escribí por qué se corrige"),
  documentoId: z.string().min(1, "Un ajuste necesita documentación de respaldo"),
});

export type EntradaCaso = z.input<typeof esquemaCaso>;
export type EntradaGasto = z.input<typeof esquemaGasto>;
export type EntradaAjuste = z.input<typeof esquemaAjuste>;
```

- [ ] **Paso 3: Crear el doble en memoria**

Crear `tests/dobles/repositorio-finanzas-memoria.ts`:

```ts
import type { Asiento, Caso, FiltroCasos, Intencion, RepositorioFinanzas, SaldoDelCaso } from "@/domains/finanzas/tipos";

export function repositorioFinanzasEnMemoria(casosIniciales: Caso[] = []) {
  const casos = [...casosIniciales];
  const asientos: Asiento[] = [];
  const intenciones: Intencion[] = [];
  let secuencia = 0;
  const id = (p: string) => `${p}-${++secuencia}`;

  const repo: RepositorioFinanzas = {
    async crearCaso(datos) {
      const caso = { ...datos, id: id("caso"), creadoEn: new Date() } as Caso;
      casos.push(caso);
      return caso;
    },
    async actualizarCaso(idCaso, cambios) {
      const i = casos.findIndex((c) => c.id === idCaso);
      if (i === -1) throw new Error("No existe el caso");
      casos[i] = { ...casos[i], ...cambios };
      return casos[i];
    },
    async casoPorId(idCaso) {
      return casos.find((c) => c.id === idCaso) ?? null;
    },
    async casoPorSlug(slug) {
      return casos.find((c) => c.slug === slug) ?? null;
    },
    async slugsDeCasos() {
      return casos.map((c) => c.slug);
    },
    async listarCasos(filtro: FiltroCasos) {
      return casos.filter(
        (c) => (!filtro.estado || c.estado === filtro.estado) && (!filtro.soloAbiertos || c.estado !== "CERRADO")
      );
    },
    async crearAsiento(datos) {
      if (datos.proveedor && datos.pagoExternoId) {
        const repetido = asientos.some((a) => a.proveedor === datos.proveedor && a.pagoExternoId === datos.pagoExternoId);
        // Espeja la restricción única de la base: sin esto, las pruebas en
        // memoria no detectarían un pago contado dos veces.
        if (repetido) throw new Error("Ya existe un asiento para ese pago");
      }
      const asiento = { ...datos, id: id("asiento"), creadoEn: new Date() } as Asiento;
      asientos.push(asiento);
      return asiento;
    },
    async asientosDeCaso(casoId) {
      return asientos.filter((a) => a.casoId === casoId);
    },
    async saldoDeCaso(casoId) {
      const propios = asientos.filter((a) => a.casoId === casoId);
      let recibidoCentavos = 0n;
      let gastadoCentavos = 0n;
      for (const a of propios) {
        if (a.centavos > 0n) recibidoCentavos += a.centavos;
        else gastadoCentavos += -a.centavos;
      }
      const cantidadDonaciones = propios.filter((a) => a.tipo === "DONACION").length;
      return { recibidoCentavos, gastadoCentavos, cantidadDonaciones } satisfies SaldoDelCaso;
    },
    async asientoPorPagoExterno(proveedor, pagoExternoId) {
      return asientos.find((a) => a.proveedor === proveedor && a.pagoExternoId === pagoExternoId) ?? null;
    },
    async crearIntencion(datos) {
      const intencion = { ...datos, id: id("intencion"), creadoEn: new Date(), resueltoEn: null } as Intencion;
      intenciones.push(intencion);
      return intencion;
    },
    async intencionPorId(idIntencion) {
      return intenciones.find((i) => i.id === idIntencion) ?? null;
    },
    async actualizarIntencion(idIntencion, cambios) {
      const i = intenciones.findIndex((x) => x.id === idIntencion);
      if (i === -1) throw new Error("No existe la intención");
      intenciones[i] = { ...intenciones[i], ...cambios };
      return intenciones[i];
    },
    async intencionesPendientes() {
      return intenciones.filter((i) => i.estado === "PENDIENTE_VERIFICACION");
    },
  };

  return Object.assign(repo, { casos, asientos, intenciones });
}
```

- [ ] **Paso 4: Verificar que compila**

Ejecutar: `npx tsc --noEmit`
Esperado: sin errores.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/finanzas tests/dobles/repositorio-finanzas-memoria.ts
git commit -m "feat: tipos, puertos y validación del dominio finanzas"
```

---

## Tarea 4: Crear y editar casos

**Archivos:**
- Crear: `src/domains/finanzas/casos.ts`
- Prueba: `tests/unidad/finanzas-casos.test.ts`

**Interfaces:**
- Consume: `esquemaCaso`, `ContextoFinanzas`, `generarSlug`/`slugDisponible` de `@/domains/animales/slug`.
- Produce: `crearCaso(entrada, ctx)`, `editarCaso(id, cambios, ctx)`, `cerrarCaso(id, ctx)`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/finanzas-casos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { crearCaso, editarCaso, cerrarCaso } from "@/domains/finanzas/casos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

const base = {
  titulo: "Luna — cirugía de cadera",
  situacion: "La atropellaron en Provincias Unidas. Tiene fractura de pelvis y necesita cirugía.",
  metaCentavos: 50000000n,
};

function contexto(rol: "ADMINISTRACION" | "FINANZAS" | "ANIMALES" | "REDACCION" = "FINANZAS") {
  return { usuarioEmail: "carla@huellas.org.ar", rol, repositorio: repositorioFinanzasEnMemoria(), auditoria: auditoriaEnMemoria() };
}

describe("crearCaso", () => {
  it("nace abierto y sin plata", async () => {
    const caso = await crearCaso(base, contexto());
    expect(caso.estado).toBe("ABIERTO");
    expect(caso.recibidoCentavos).toBe(0n);
    expect(caso.gastadoCentavos).toBe(0n);
  });

  it("le asigna una dirección permanente a partir del título", async () => {
    const caso = await crearCaso(base, contexto());
    expect(caso.slug).toBe("luna-cirugia-de-cadera");
  });

  it("evita colisiones de dirección", async () => {
    const ctx = contexto();
    await crearCaso(base, ctx);
    const segundo = await crearCaso(base, ctx);
    expect(segundo.slug).toBe("luna-cirugia-de-cadera-2");
  });

  it("rechaza una meta de cero o negativa", async () => {
    await expect(crearCaso({ ...base, metaCentavos: 0n }, contexto())).rejects.toThrow(/mayor que cero/i);
  });

  it("rechaza una situación demasiado corta para explicar el caso", async () => {
    await expect(crearCaso({ ...base, situacion: "se lastimó" }, contexto())).rejects.toThrow(/qué le pasó/i);
  });

  it("el rol de animales no puede crear casos: no escribe dinero", async () => {
    await expect(crearCaso(base, contexto("ANIMALES"))).rejects.toThrow(/permiso/i);
  });

  it("deja rastro en auditoría", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas.at(-1)).toMatchObject({ accion: "caso.crear", entidadId: caso.id });
  });
});

describe("editarCaso", () => {
  it("la dirección permanente no cambia al corregir el título", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const editado = await editarCaso(caso.id, { titulo: "Luna — cirugía de cadera y rehabilitación" }, ctx);
    expect(editado.slug).toBe("luna-cirugia-de-cadera");
  });

  it("la meta se puede corregir: es un objetivo, no un hecho contable", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const editado = await editarCaso(caso.id, { metaCentavos: 62000000n }, ctx);
    expect(editado.metaCentavos).toBe(62000000n);
  });

  it("ignora cualquier intento de escribir los saldos", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const editado = await editarCaso(caso.id, { recibidoCentavos: 99999999n } as never, ctx);
    expect(editado.recibidoCentavos).toBe(0n);
  });
});

describe("cerrarCaso", () => {
  it("un caso cerrado sigue existiendo y conserva su dirección", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const cerrado = await cerrarCaso(caso.id, ctx);
    expect(cerrado.estado).toBe("CERRADO");
    expect(await ctx.repositorio.casoPorSlug(caso.slug)).not.toBeNull();
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/finanzas-casos.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/finanzas/casos.ts`:

```ts
import { generarSlug, slugDisponible } from "@/domains/animales/slug";
import { puede } from "@/domains/usuarios/autorizacion";
import { esquemaCaso, type EntradaCaso } from "./esquemas";
import type { Caso, ContextoFinanzas } from "./tipos";

/** El permiso se verifica acá, no en la pantalla: esconder un botón no es seguridad. */
export function exigirPermisoSobreFinanzas(ctx: ContextoFinanzas): void {
  if (!puede(ctx.rol, "finanzas.escribir")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para escribir movimientos de dinero`);
  }
}

export async function exigirCaso(id: string, ctx: ContextoFinanzas): Promise<Caso> {
  const caso = await ctx.repositorio.casoPorId(id);
  if (!caso) throw new Error("No existe el caso");
  return caso;
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
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/finanzas-casos.test.ts`
Esperado: PASAN las 11.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/finanzas/casos.ts tests/unidad/finanzas-casos.test.ts
git commit -m "feat: alta y edición de casos financieros

Los saldos no se pueden escribir desde la edición: son derivados de los
asientos, y esa es la regla que sostiene la transparencia."
```

---

## Tarea 5: El asiento contable — la operación central

Esta es la tarea más importante del proyecto. Todo lo demás depende de que esté bien.

**Archivos:**
- Crear: `src/domains/finanzas/asientos.ts`
- Prueba: `tests/unidad/finanzas-asientos.test.ts`

**Interfaces:**
- Consume: `exigirPermisoSobreFinanzas`, `exigirCaso` de `./casos`.
- Produce: `registrarAsiento(entrada, ctx)`, `registrarGasto(entrada, ctx)`, `type EntradaAsiento`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/finanzas-asientos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { registrarAsiento, registrarGasto } from "@/domains/finanzas/asientos";
import { crearCaso } from "@/domains/finanzas/casos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

const base = {
  titulo: "Luna — cirugía",
  situacion: "La atropellaron en Provincias Unidas y necesita cirugía de cadera.",
  metaCentavos: 50000000n, // $500.000
};

function contexto(rol: "ADMINISTRACION" | "FINANZAS" | "REDACCION" = "FINANZAS") {
  return { usuarioEmail: "carla@huellas.org.ar", rol, repositorio: repositorioFinanzasEnMemoria(), auditoria: auditoriaEnMemoria() };
}

async function casoConContexto() {
  const ctx = contexto();
  const caso = await crearCaso(base, ctx);
  return { ctx, caso };
}

describe("registrarAsiento", () => {
  it("una donación mueve el recibido del caso", async () => {
    const { ctx, caso } = await casoConContexto();
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 2500000n, descripcion: "Donación", fechaEfectiva: new Date() }, ctx);
    const actualizado = await ctx.repositorio.casoPorId(caso.id);
    expect(actualizado!.recibidoCentavos).toBe(2500000n);
    expect(actualizado!.gastadoCentavos).toBe(0n);
    expect(actualizado!.cantidadDonantes).toBe(1);
  });

  it("el saldo sale de sumar los asientos, no de acumular a ciegas", async () => {
    const { ctx, caso } = await casoConContexto();
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 2500000n, descripcion: "Una", fechaEfectiva: new Date() }, ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000000n, descripcion: "Otra", fechaEfectiva: new Date() }, ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "GASTO", centavos: -800000n, descripcion: "Estudios", fechaEfectiva: new Date() }, ctx);

    const actualizado = await ctx.repositorio.casoPorId(caso.id);
    expect(actualizado!.recibidoCentavos).toBe(3500000n);
    expect(actualizado!.gastadoCentavos).toBe(800000n);
    expect(actualizado!.cantidadDonantes).toBe(2);
  });

  it("al superar la meta el caso queda en meta alcanzada, pero sigue abierto a donaciones", async () => {
    const { ctx, caso } = await casoConContexto();
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 62000000n, descripcion: "Grande", fechaEfectiva: new Date() }, ctx);
    const actualizado = await ctx.repositorio.casoPorId(caso.id);
    expect(actualizado!.estado).toBe("META_ALCANZADA");

    // Sigue aceptando: en una urgencia el presupuesto real supera al estimado.
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 500000n, descripcion: "Otra más", fechaEfectiva: new Date() }, ctx);
    expect((await ctx.repositorio.casoPorId(caso.id))!.recibidoCentavos).toBe(62500000n);
  });

  it("un caso cerrado no acepta movimientos nuevos", async () => {
    const { ctx, caso } = await casoConContexto();
    await ctx.repositorio.actualizarCaso(caso.id, { estado: "CERRADO" });
    await expect(
      registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000n, descripcion: "Tardía", fechaEfectiva: new Date() }, ctx)
    ).rejects.toThrow(/cerrado/i);
  });

  it("el mismo pago no puede generar dos asientos", async () => {
    const { ctx, caso } = await casoConContexto();
    const pago = { casoId: caso.id, tipo: "DONACION" as const, centavos: 1000000n, descripcion: "Donación", fechaEfectiva: new Date(), proveedor: "mercadopago", pagoExternoId: "1327884391" };
    await registrarAsiento(pago, ctx);
    await expect(registrarAsiento(pago, ctx)).rejects.toThrow();
    expect((await ctx.repositorio.casoPorId(caso.id))!.recibidoCentavos).toBe(1000000n);
  });

  it("el rol de redacción no puede registrar movimientos", async () => {
    const { caso } = await casoConContexto();
    const ctxRedaccion = contexto("REDACCION");
    await expect(
      registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000n, descripcion: "x", fechaEfectiva: new Date() }, ctxRedaccion)
    ).rejects.toThrow(/permiso/i);
  });

  it("deja rastro en auditoría con el importe", async () => {
    const { ctx, caso } = await casoConContexto();
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 2500000n, descripcion: "Donación", fechaEfectiva: new Date() }, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas.at(-1)).toMatchObject({ accion: "asiento.crear", entidad: "AsientoContable" });
  });
});

describe("registrarGasto", () => {
  it("guarda el importe en negativo aunque se cargue en positivo", async () => {
    const { ctx, caso } = await casoConContexto();
    const asiento = await registrarGasto({ casoId: caso.id, centavos: 6200000n, descripcion: "Estudios prequirúrgicos", documentoId: "doc-1", fechaEfectiva: new Date() }, ctx);
    expect(asiento.centavos).toBe(-6200000n);
    expect((await ctx.repositorio.casoPorId(caso.id))!.gastadoCentavos).toBe(6200000n);
  });

  it("un gasto sin comprobante se registra igual, pero queda marcado", async () => {
    const { ctx, caso } = await casoConContexto();
    const asiento = await registrarGasto({ casoId: caso.id, centavos: 100000n, descripcion: "Taxi a la veterinaria", documentoId: null, fechaEfectiva: new Date() }, ctx);
    expect(asiento.documentoId).toBeNull();
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/finanzas-asientos.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/finanzas/asientos.ts`:

```ts
import { esquemaGasto, type EntradaGasto } from "./esquemas";
import { exigirCaso, exigirPermisoSobreFinanzas } from "./casos";
import type { Asiento, ContextoFinanzas, EstadoCaso, TipoAsiento } from "./tipos";

export interface EntradaAsiento {
  casoId: string;
  tipo: TipoAsiento;
  /** Positivo entra, negativo sale. */
  centavos: bigint;
  descripcion: string;
  fechaEfectiva: Date;
  proveedor?: string | null;
  pagoExternoId?: string | null;
  ajustaAId?: string | null;
  contraparteId?: string | null;
  documentoId?: string | null;
  intencionId?: string | null;
  creadoPorSistema?: boolean;
}

/**
 * El caso alcanza la meta pero no se cierra solo: en una urgencia médica el
 * presupuesto real suele superar al estimado, y cortar el botón de donar
 * frustra a quien quiere ayudar igual. Cerrar es una decisión de una persona.
 */
function estadoSegunSaldo(estadoActual: EstadoCaso, recibidoCentavos: bigint, metaCentavos: bigint): EstadoCaso {
  if (estadoActual === "CERRADO") return "CERRADO";
  return recibidoCentavos >= metaCentavos ? "META_ALCANZADA" : "ABIERTO";
}

/**
 * La única puerta por la que se mueve plata. Escribe el asiento y recalcula los
 * saldos del caso en la misma transacción.
 *
 * Los saldos se recalculan desde la suma de los asientos, no se acumulan sobre
 * el valor anterior. Es más trabajo, y es a propósito: un acumulador que se
 * desincroniza una vez queda mal para siempre, mientras que una suma vuelve a
 * dar el número correcto sola.
 */
export async function registrarAsiento(entrada: EntradaAsiento, ctx: ContextoFinanzas): Promise<Asiento> {
  exigirPermisoSobreFinanzas(ctx);
  const caso = await exigirCaso(entrada.casoId, ctx);

  if (caso.estado === "CERRADO") {
    throw new Error("El caso está cerrado: no acepta movimientos nuevos. Si hay que corregir algo, registrá un ajuste.");
  }
  if (entrada.centavos === 0n) {
    throw new Error("Un movimiento de cero no dice nada: no se registra");
  }

  const asiento = await ctx.repositorio.crearAsiento({
    casoId: caso.id,
    tipo: entrada.tipo,
    centavos: entrada.centavos,
    moneda: caso.moneda,
    descripcion: entrada.descripcion,
    proveedor: entrada.proveedor ?? null,
    pagoExternoId: entrada.pagoExternoId ?? null,
    ajustaAId: entrada.ajustaAId ?? null,
    contraparteId: entrada.contraparteId ?? null,
    documentoId: entrada.documentoId ?? null,
    intencionId: entrada.intencionId ?? null,
    creadoPorId: null,
    creadoPorSistema: entrada.creadoPorSistema ?? false,
    fechaEfectiva: entrada.fechaEfectiva,
  });

  const saldo = await ctx.repositorio.saldoDeCaso(caso.id);
  await ctx.repositorio.actualizarCaso(caso.id, {
    recibidoCentavos: saldo.recibidoCentavos,
    gastadoCentavos: saldo.gastadoCentavos,
    cantidadDonantes: saldo.cantidadDonaciones,
    estado: estadoSegunSaldo(caso.estado, saldo.recibidoCentavos, caso.metaCentavos),
  });

  await ctx.auditoria.registrar({
    usuarioEmail: entrada.creadoPorSistema ? "sistema" : ctx.usuarioEmail,
    accion: "asiento.crear",
    entidad: "AsientoContable",
    entidadId: asiento.id,
    valorNuevo: {
      casoId: caso.id,
      tipo: asiento.tipo,
      centavos: asiento.centavos.toString(),
      descripcion: asiento.descripcion,
    },
  });

  return asiento;
}

/** Un gasto se carga en positivo y se guarda en negativo: quien lo escribe piensa en cuánto salió. */
export async function registrarGasto(entrada: EntradaGasto, ctx: ContextoFinanzas): Promise<Asiento> {
  const datos = esquemaGasto.parse(entrada);
  return registrarAsiento(
    {
      casoId: datos.casoId,
      tipo: "GASTO",
      centavos: -datos.centavos,
      descripcion: datos.descripcion,
      documentoId: datos.documentoId,
      fechaEfectiva: datos.fechaEfectiva,
    },
    ctx
  );
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/finanzas-asientos.test.ts`
Esperado: PASAN las 9.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/finanzas/asientos.ts tests/unidad/finanzas-asientos.test.ts
git commit -m "feat: registro de asientos contables con recálculo de saldos

Los saldos se recalculan desde la suma de asientos, no se acumulan: un
acumulador que se desincroniza una vez queda mal para siempre."
```

---

## Tarea 6: Transferencias bancarias verificadas a mano

**Archivos:**
- Crear: `src/domains/finanzas/donaciones.ts`
- Prueba: `tests/unidad/finanzas-transferencias.test.ts`

**Interfaces:**
- Consume: `registrarAsiento`, `exigirCaso`.
- Produce: `declararTransferencia(entrada, repositorio)`, `verificarTransferencia(intencionId, ctx)`, `rechazarTransferencia(intencionId, motivo, ctx)`, `totalPendienteDeVerificar(casoId, repositorio)`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/finanzas-transferencias.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { declararTransferencia, verificarTransferencia, rechazarTransferencia, totalPendienteDeVerificar } from "@/domains/finanzas/donaciones";
import { crearCaso } from "@/domains/finanzas/casos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

const base = {
  titulo: "Luna — cirugía",
  situacion: "La atropellaron en Provincias Unidas y necesita cirugía de cadera.",
  metaCentavos: 50000000n,
};

function contexto(rol: "ADMINISTRACION" | "FINANZAS" | "REDACCION" = "FINANZAS") {
  return { usuarioEmail: "carla@huellas.org.ar", rol, repositorio: repositorioFinanzasEnMemoria(), auditoria: auditoriaEnMemoria() };
}

async function casoConTransferencia() {
  const ctx = contexto();
  const caso = await crearCaso(base, ctx);
  const intencion = await declararTransferencia(
    { casoId: caso.id, centavos: 1000000n, nombreDonante: "Marina", publicarNombre: false, comprobanteId: "doc-1" },
    ctx.repositorio
  );
  return { ctx, caso, intencion };
}

describe("declararTransferencia", () => {
  it("queda pendiente de verificación, no aprobada", async () => {
    const { intencion } = await casoConTransferencia();
    expect(intencion.estado).toBe("PENDIENTE_VERIFICACION");
    expect(intencion.proveedor).toBe("transferencia");
  });

  it("lo pendiente NO suma al total público del caso", async () => {
    const { ctx, caso } = await casoConTransferencia();
    const actualizado = await ctx.repositorio.casoPorId(caso.id);
    expect(actualizado!.recibidoCentavos).toBe(0n);
  });

  it("el total pendiente se puede consultar aparte, para mostrarlo como pendiente", async () => {
    const { ctx, caso } = await casoConTransferencia();
    expect(await totalPendienteDeVerificar(caso.id, ctx.repositorio)).toBe(1000000n);
  });

  it("no exige sesión: la declara quien donó, desde el sitio público", async () => {
    const ctx = contexto();
    const caso = await crearCaso(base, ctx);
    const intencion = await declararTransferencia(
      { casoId: caso.id, centavos: 500000n, nombreDonante: null, publicarNombre: false, comprobanteId: "doc-2" },
      ctx.repositorio
    );
    expect(intencion.id).toBeTruthy();
  });
});

describe("verificarTransferencia", () => {
  it("crea el asiento y recién ahí suma al total público", async () => {
    const { ctx, caso, intencion } = await casoConTransferencia();
    await verificarTransferencia(intencion.id, ctx);
    const actualizado = await ctx.repositorio.casoPorId(caso.id);
    expect(actualizado!.recibidoCentavos).toBe(1000000n);
    expect((await ctx.repositorio.intencionPorId(intencion.id))!.estado).toBe("APROBADA");
  });

  it("ya no queda pendiente", async () => {
    const { ctx, caso, intencion } = await casoConTransferencia();
    await verificarTransferencia(intencion.id, ctx);
    expect(await totalPendienteDeVerificar(caso.id, ctx.repositorio)).toBe(0n);
  });

  it("no se puede verificar dos veces", async () => {
    const { ctx, intencion } = await casoConTransferencia();
    await verificarTransferencia(intencion.id, ctx);
    await expect(verificarTransferencia(intencion.id, ctx)).rejects.toThrow(/ya .*verificada|no está pendiente/i);
  });

  it("el rol de redacción no puede verificar", async () => {
    const { ctx, intencion } = await casoConTransferencia();
    const ctxRedaccion = { ...ctx, rol: "REDACCION" as const };
    await expect(verificarTransferencia(intencion.id, ctxRedaccion)).rejects.toThrow(/permiso/i);
  });

  it("deja rastro de quién la verificó", async () => {
    const { ctx, intencion } = await casoConTransferencia();
    await verificarTransferencia(intencion.id, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas.some((e) => e.accion === "transferencia.verificar" && e.usuarioEmail === "carla@huellas.org.ar")).toBe(true);
  });
});

describe("rechazarTransferencia", () => {
  it("queda rechazada y nunca suma", async () => {
    const { ctx, caso, intencion } = await casoConTransferencia();
    await rechazarTransferencia(intencion.id, "No aparece en el extracto del Banco Nación", ctx);
    expect((await ctx.repositorio.intencionPorId(intencion.id))!.estado).toBe("RECHAZADA");
    expect((await ctx.repositorio.casoPorId(caso.id))!.recibidoCentavos).toBe(0n);
  });

  it("exige un motivo: el rechazo también se audita", async () => {
    const { ctx, intencion } = await casoConTransferencia();
    await expect(rechazarTransferencia(intencion.id, "", ctx)).rejects.toThrow(/motivo/i);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/finanzas-transferencias.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/finanzas/donaciones.ts`:

```ts
import { registrarAsiento } from "./asientos";
import { exigirPermisoSobreFinanzas } from "./casos";
import type { ContextoFinanzas, Intencion, RepositorioFinanzas } from "./tipos";

export interface EntradaTransferencia {
  casoId: string;
  centavos: bigint;
  nombreDonante: string | null;
  publicarNombre: boolean;
  mensaje?: string | null;
  comprobanteId: string | null;
}

/**
 * La declara quien donó, desde el sitio público, así que no exige sesión ni
 * permisos: solo registra que alguien dice haber transferido. Queda pendiente
 * hasta que una persona la compare contra el extracto bancario.
 */
export async function declararTransferencia(
  entrada: EntradaTransferencia,
  repositorio: RepositorioFinanzas
): Promise<Intencion> {
  if (entrada.centavos <= 0n) throw new Error("El importe tiene que ser mayor que cero");
  const caso = await repositorio.casoPorId(entrada.casoId);
  if (!caso) throw new Error("No existe el caso");

  return repositorio.crearIntencion({
    casoId: entrada.casoId,
    centavos: entrada.centavos,
    moneda: caso.moneda,
    nombreDonante: entrada.nombreDonante,
    publicarNombre: entrada.publicarNombre,
    mensaje: entrada.mensaje ?? null,
    proveedor: "transferencia",
    estado: "PENDIENTE_VERIFICACION",
    referenciaExterna: null,
    pagoExternoId: null,
    comprobanteId: entrada.comprobanteId,
  });
}

/** Lo pendiente se muestra aparte y nunca entra en el total público. */
export async function totalPendienteDeVerificar(casoId: string, repositorio: RepositorioFinanzas): Promise<bigint> {
  const pendientes = await repositorio.intencionesPendientes();
  return pendientes.filter((i) => i.casoId === casoId).reduce((total, i) => total + i.centavos, 0n);
}

async function exigirPendiente(intencionId: string, ctx: ContextoFinanzas): Promise<Intencion> {
  const intencion = await ctx.repositorio.intencionPorId(intencionId);
  if (!intencion) throw new Error("No existe la transferencia declarada");
  if (intencion.estado !== "PENDIENTE_VERIFICACION") {
    throw new Error(`La transferencia no está pendiente: su estado es ${intencion.estado}`);
  }
  return intencion;
}

export async function verificarTransferencia(intencionId: string, ctx: ContextoFinanzas): Promise<Intencion> {
  exigirPermisoSobreFinanzas(ctx);
  const intencion = await exigirPendiente(intencionId, ctx);

  const asiento = await registrarAsiento(
    {
      casoId: intencion.casoId,
      tipo: "DONACION",
      centavos: intencion.centavos,
      descripcion: "Transferencia verificada contra el extracto bancario",
      proveedor: "transferencia",
      intencionId: intencion.id,
      documentoId: intencion.comprobanteId,
      fechaEfectiva: new Date(),
    },
    ctx
  );

  const aprobada = await ctx.repositorio.actualizarIntencion(intencion.id, {
    estado: "APROBADA",
    resueltoEn: new Date(),
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "transferencia.verificar",
    entidad: "IntencionDonacion",
    entidadId: intencion.id,
    valorAnterior: { estado: "PENDIENTE_VERIFICACION" },
    valorNuevo: { estado: "APROBADA", asientoId: asiento.id },
  });

  return aprobada;
}

export async function rechazarTransferencia(intencionId: string, motivo: string, ctx: ContextoFinanzas): Promise<Intencion> {
  exigirPermisoSobreFinanzas(ctx);
  if (motivo.trim().length === 0) throw new Error("Escribí el motivo del rechazo: también queda auditado");
  const intencion = await exigirPendiente(intencionId, ctx);

  const rechazada = await ctx.repositorio.actualizarIntencion(intencion.id, {
    estado: "RECHAZADA",
    resueltoEn: new Date(),
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "transferencia.rechazar",
    entidad: "IntencionDonacion",
    entidadId: intencion.id,
    valorAnterior: { estado: "PENDIENTE_VERIFICACION" },
    valorNuevo: { estado: "RECHAZADA", motivo },
  });

  return rechazada;
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/finanzas-transferencias.test.ts`
Esperado: PASAN las 11.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/finanzas/donaciones.ts tests/unidad/finanzas-transferencias.test.ts
git commit -m "feat: transferencias bancarias con verificación manual

Lo pendiente no suma al total público hasta que una persona lo compara
contra el extracto."
```

---

## Tarea 7: Ajustes y traslados entre casos

**Archivos:**
- Crear: `src/domains/finanzas/ajustes.ts`
- Prueba: `tests/unidad/finanzas-ajustes.test.ts`

**Interfaces:**
- Consume: `registrarAsiento`, `exigirCaso`, `esquemaAjuste`.
- Produce: `registrarAjuste(entrada, ctx)`, `trasladarEntreCasos(entrada, ctx)`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/finanzas-ajustes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { registrarAjuste, trasladarEntreCasos } from "@/domains/finanzas/ajustes";
import { registrarAsiento } from "@/domains/finanzas/asientos";
import { crearCaso } from "@/domains/finanzas/casos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

function contexto(rol: "ADMINISTRACION" | "FINANZAS" | "REDACCION" = "FINANZAS") {
  return { usuarioEmail: "carla@huellas.org.ar", rol, repositorio: repositorioFinanzasEnMemoria(), auditoria: auditoriaEnMemoria() };
}

async function dosCasosConPlata() {
  const ctx = contexto();
  const rocky = await crearCaso({ titulo: "Rocky — fractura de fémur", situacion: "Lo atropellaron y necesita cirugía traumatológica urgente.", metaCentavos: 50000000n }, ctx);
  const max = await crearCaso({ titulo: "Max — tratamiento veterinario", situacion: "Necesita tratamiento prolongado por una infección severa.", metaCentavos: 30000000n }, ctx);
  await registrarAsiento({ casoId: rocky.id, tipo: "DONACION", centavos: 62000000n, descripcion: "Donaciones", fechaEfectiva: new Date() }, ctx);
  return { ctx, rocky, max };
}

describe("registrarAjuste", () => {
  it("crea un asiento nuevo en vez de tocar el original", async () => {
    const ctx = contexto();
    const caso = await crearCaso({ titulo: "Luna — cirugía", situacion: "La atropellaron y necesita cirugía de cadera urgente.", metaCentavos: 50000000n }, ctx);
    const original = await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 2500000n, descripcion: "Donación", fechaEfectiva: new Date(), proveedor: "mercadopago", pagoExternoId: "1327884391" }, ctx);

    const ajuste = await registrarAjuste(
      { casoId: caso.id, centavos: -2500000n, ajustaAId: original.id, motivo: "Contracargo del pago 1327884391", documentoId: "doc-contracargo" },
      ctx
    );

    expect(ajuste.tipo).toBe("AJUSTE");
    expect(ajuste.ajustaAId).toBe(original.id);
    // El original sigue intacto en el libro.
    const asientos = await ctx.repositorio.asientosDeCaso(caso.id);
    expect(asientos).toHaveLength(2);
    expect(asientos[0].centavos).toBe(2500000n);
    // Y el saldo refleja las dos líneas.
    expect((await ctx.repositorio.casoPorId(caso.id))!.recibidoCentavos).toBe(2500000n);
    expect((await ctx.repositorio.casoPorId(caso.id))!.gastadoCentavos).toBe(2500000n);
  });

  it("exige motivo: el ajuste queda publicado", async () => {
    const ctx = contexto();
    const caso = await crearCaso({ titulo: "Luna", situacion: "La atropellaron y necesita cirugía de cadera urgente.", metaCentavos: 50000000n }, ctx);
    const original = await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000n, descripcion: "x", fechaEfectiva: new Date() }, ctx);
    await expect(
      registrarAjuste({ casoId: caso.id, centavos: -1000n, ajustaAId: original.id, motivo: "error", documentoId: "doc-1" }, ctx)
    ).rejects.toThrow(/motivo/i);
  });

  it("exige documentación de respaldo", async () => {
    const ctx = contexto();
    const caso = await crearCaso({ titulo: "Luna", situacion: "La atropellaron y necesita cirugía de cadera urgente.", metaCentavos: 50000000n }, ctx);
    const original = await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000n, descripcion: "x", fechaEfectiva: new Date() }, ctx);
    await expect(
      registrarAjuste({ casoId: caso.id, centavos: -1000n, ajustaAId: original.id, motivo: "Contracargo del pago informado por el banco", documentoId: "" }, ctx)
    ).rejects.toThrow(/respaldo/i);
  });
});

describe("trasladarEntreCasos", () => {
  it("deja las dos puntas, vinculadas", async () => {
    const { ctx, rocky, max } = await dosCasosConPlata();
    const { salida, entrada } = await trasladarEntreCasos(
      { origenId: rocky.id, destinoId: max.id, centavos: 12000000n, motivo: "Excedente de Rocky asignado por acta de comisión N.º 47" },
      ctx
    );

    expect(salida.centavos).toBe(-12000000n);
    expect(entrada.centavos).toBe(12000000n);

    // El vínculo se guarda de un solo lado, y no es una simplificación: los
    // asientos son inmutables, así que el segundo no puede volver atrás a
    // completar el primero. La salida se crea después y apunta a la entrada;
    // desde la entrada se llega por la relación inversa del esquema.
    expect(salida.contraparteId).toBe(entrada.id);
    expect(entrada.contraparteId).toBeNull();
  });

  it("el asiento de llegada se puede encontrar desde su contraparte", async () => {
    const { ctx, rocky, max } = await dosCasosConPlata();
    const { salida, entrada } = await trasladarEntreCasos(
      { origenId: rocky.id, destinoId: max.id, centavos: 12000000n, motivo: "Excedente de Rocky asignado por acta de comisión N.º 47" },
      ctx
    );

    const asientosDelDestino = await ctx.repositorio.asientosDeCaso(max.id);
    const llegada = asientosDelDestino.find((a) => a.id === entrada.id);
    expect(llegada).toBeDefined();

    const asientosDelOrigen = await ctx.repositorio.asientosDeCaso(rocky.id);
    expect(asientosDelOrigen.find((a) => a.contraparteId === llegada!.id)?.id).toBe(salida.id);
  });

  it("mueve el saldo de los dos casos", async () => {
    const { ctx, rocky, max } = await dosCasosConPlata();
    await trasladarEntreCasos({ origenId: rocky.id, destinoId: max.id, centavos: 12000000n, motivo: "Excedente de Rocky asignado por acta de comisión N.º 47" }, ctx);
    expect((await ctx.repositorio.casoPorId(rocky.id))!.gastadoCentavos).toBe(12000000n);
    expect((await ctx.repositorio.casoPorId(max.id))!.recibidoCentavos).toBe(12000000n);
  });

  it("no traslada más de lo disponible", async () => {
    const { ctx, rocky, max } = await dosCasosConPlata();
    await expect(
      trasladarEntreCasos({ origenId: rocky.id, destinoId: max.id, centavos: 99000000n, motivo: "Excedente de Rocky asignado por acta de comisión N.º 47" }, ctx)
    ).rejects.toThrow(/disponible/i);
  });

  it("no traslada un caso a sí mismo", async () => {
    const { ctx, rocky } = await dosCasosConPlata();
    await expect(
      trasladarEntreCasos({ origenId: rocky.id, destinoId: rocky.id, centavos: 1000n, motivo: "Excedente de Rocky asignado por acta de comisión N.º 47" }, ctx)
    ).rejects.toThrow(/mismo caso/i);
  });

  it("exige motivo", async () => {
    const { ctx, rocky, max } = await dosCasosConPlata();
    await expect(
      trasladarEntreCasos({ origenId: rocky.id, destinoId: max.id, centavos: 1000n, motivo: "porque sí" }, ctx)
    ).rejects.toThrow(/motivo/i);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/finanzas-ajustes.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/finanzas/ajustes.ts`:

```ts
import { esquemaAjuste, type EntradaAjuste } from "./esquemas";
import { registrarAsiento } from "./asientos";
import { exigirCaso, exigirPermisoSobreFinanzas } from "./casos";
import type { Asiento, ContextoFinanzas } from "./tipos";

/**
 * Una corrección nunca reescribe el pasado: crea un asiento nuevo que apunta al
 * que corrige. El original sigue visible en el libro público, y al lado se ve
 * la corrección con su motivo. Eso es lo que hace auditable el historial.
 */
export async function registrarAjuste(entrada: EntradaAjuste, ctx: ContextoFinanzas): Promise<Asiento> {
  exigirPermisoSobreFinanzas(ctx);
  const datos = esquemaAjuste.parse(entrada);

  return registrarAsiento(
    {
      casoId: datos.casoId,
      tipo: "AJUSTE",
      centavos: datos.centavos,
      descripcion: `Ajuste: ${datos.motivo}`,
      ajustaAId: datos.ajustaAId,
      documentoId: datos.documentoId,
      fechaEfectiva: new Date(),
    },
    ctx
  );
}

export interface EntradaTraslado {
  origenId: string;
  destinoId: string;
  centavos: bigint;
  motivo: string;
}

/**
 * Un traslado son dos asientos vinculados, escritos juntos. Aparece en el libro
 * público de los dos casos: no hay forma de mover plata sin dejar las dos
 * puntas registradas.
 */
export async function trasladarEntreCasos(
  entrada: EntradaTraslado,
  ctx: ContextoFinanzas
): Promise<{ salida: Asiento; entrada: Asiento }> {
  exigirPermisoSobreFinanzas(ctx);

  if (entrada.origenId === entrada.destinoId) {
    throw new Error("No se puede trasladar un caso al mismo caso");
  }
  if (entrada.centavos <= 0n) {
    throw new Error("El importe del traslado tiene que ser mayor que cero");
  }
  if (entrada.motivo.trim().length < 10) {
    throw new Error("Escribí el motivo del traslado: queda publicado en los dos casos");
  }

  const origen = await exigirCaso(entrada.origenId, ctx);
  await exigirCaso(entrada.destinoId, ctx);

  const disponible = origen.recibidoCentavos - origen.gastadoCentavos;
  if (entrada.centavos > disponible) {
    throw new Error(`El caso de origen no tiene ese saldo disponible: quedan ${disponible} centavos`);
  }

  // El orden importa y no es arbitrario. Los asientos son inmutables: el
  // disparador de la base rechaza cualquier UPDATE, así que el segundo asiento
  // no puede volver atrás a completarle el vínculo al primero. Por eso se crea
  // primero la llegada, y después la salida apuntando a ella.
  //
  // Con un solo lado alcanza: el esquema declara la relación inversa, así que
  // desde la llegada se llega a la salida sin guardar nada más.
  const llegada = await registrarAsiento(
    {
      casoId: entrada.destinoId,
      tipo: "TRANSFERENCIA",
      centavos: entrada.centavos,
      descripcion: `Traslado desde otro caso: ${entrada.motivo}`,
      fechaEfectiva: new Date(),
    },
    ctx
  );

  const salida = await registrarAsiento(
    {
      casoId: entrada.origenId,
      tipo: "TRANSFERENCIA",
      centavos: -entrada.centavos,
      descripcion: `Traslado a otro caso: ${entrada.motivo}`,
      contraparteId: llegada.id,
      fechaEfectiva: new Date(),
    },
    ctx
  );

  return { salida, entrada: llegada };
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/finanzas-ajustes.test.ts`
Esperado: PASAN las 8.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/finanzas/ajustes.ts tests/unidad/finanzas-ajustes.test.ts
git commit -m "feat: ajustes contables y traslados entre casos

Un ajuste no reescribe el pasado: crea un asiento que apunta al original.
Un traslado deja las dos puntas o ninguna."
```

---

## Tarea 8: Repositorio Prisma de finanzas

**Archivos:**
- Crear: `src/infra/repositorios/finanzas.ts`
- Prueba: `tests/integracion/finanzas-repositorio.test.ts`

**Interfaces:**
- Consume: el puerto `RepositorioFinanzas`, `prisma`.
- Produce: `repositorioFinanzasPrisma(cliente?)`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/integracion/finanzas-repositorio.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearCaso } from "@/domains/finanzas/casos";
import { registrarAsiento } from "@/domains/finanzas/asientos";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const casos: string[] = [];

afterAll(async () => {
  await prisma.asientoContable.deleteMany({ where: { casoId: { in: casos } } });
  await prisma.casoFinanciero.deleteMany({ where: { id: { in: casos } } });
  await prisma.$disconnect();
});

const base = {
  titulo: `Caso ${Date.now()}`,
  situacion: "Descripción de prueba suficientemente larga para pasar la validación.",
  metaCentavos: 50000000n,
};

describe("repositorio Prisma de finanzas", () => {
  it("los saldos se escriben en la misma transacción que el asiento", async () => {
    const caso = await prisma.$transaction(async (tx) =>
      crearCaso(base, {
        usuarioEmail: "prueba@huellas.org.ar",
        rol: "FINANZAS",
        repositorio: repositorioFinanzasPrisma(tx),
        auditoria: auditoriaPrisma(tx),
      })
    );
    casos.push(caso.id);

    await prisma.$transaction(async (tx) =>
      registrarAsiento(
        { casoId: caso.id, tipo: "DONACION", centavos: 2500000n, descripcion: "Donación", fechaEfectiva: new Date() },
        { usuarioEmail: "prueba@huellas.org.ar", rol: "FINANZAS", repositorio: repositorioFinanzasPrisma(tx), auditoria: auditoriaPrisma(tx) }
      )
    );

    const guardado = await prisma.casoFinanciero.findUnique({ where: { id: caso.id } });
    expect(guardado!.recibidoCentavos).toBe(2500000n);
  });

  it("si falla la auditoría no queda ni el asiento ni el saldo", async () => {
    const caso = await prisma.$transaction(async (tx) =>
      crearCaso({ ...base, titulo: `Caso fallido ${Date.now()}` }, {
        usuarioEmail: "prueba@huellas.org.ar",
        rol: "FINANZAS",
        repositorio: repositorioFinanzasPrisma(tx),
        auditoria: auditoriaPrisma(tx),
      })
    );
    casos.push(caso.id);

    await expect(
      prisma.$transaction(async (tx) =>
        registrarAsiento(
          { casoId: caso.id, tipo: "DONACION", centavos: 999999n, descripcion: "No debe quedar", fechaEfectiva: new Date() },
          {
            usuarioEmail: "prueba@huellas.org.ar",
            rol: "FINANZAS",
            repositorio: repositorioFinanzasPrisma(tx),
            auditoria: { async registrar() { throw new Error("auditoría caída"); } },
          }
        )
      )
    ).rejects.toThrow(/auditoría caída/);

    const guardado = await prisma.casoFinanciero.findUnique({ where: { id: caso.id } });
    expect(guardado!.recibidoCentavos).toBe(0n);
    expect(await prisma.asientoContable.count({ where: { casoId: caso.id } })).toBe(0);
  });

  it("el saldo se calcula sumando en la base, no trayendo todas las filas", async () => {
    const caso = await prisma.$transaction(async (tx) =>
      crearCaso({ ...base, titulo: `Caso suma ${Date.now()}` }, {
        usuarioEmail: "prueba@huellas.org.ar",
        rol: "FINANZAS",
        repositorio: repositorioFinanzasPrisma(tx),
        auditoria: auditoriaPrisma(tx),
      })
    );
    casos.push(caso.id);

    for (const centavos of [1000000n, 2000000n, -500000n]) {
      await prisma.$transaction(async (tx) =>
        registrarAsiento(
          { casoId: caso.id, tipo: centavos > 0n ? "DONACION" : "GASTO", centavos, descripcion: "Movimiento", fechaEfectiva: new Date() },
          { usuarioEmail: "prueba@huellas.org.ar", rol: "FINANZAS", repositorio: repositorioFinanzasPrisma(tx), auditoria: auditoriaPrisma(tx) }
        )
      );
    }

    const saldo = await repositorioFinanzasPrisma(prisma).saldoDeCaso(caso.id);
    expect(saldo.recibidoCentavos).toBe(3000000n);
    expect(saldo.gastadoCentavos).toBe(500000n);
    expect(saldo.cantidadDonaciones).toBe(2);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/integracion/finanzas-repositorio.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/infra/repositorios/finanzas.ts`, siguiendo el patrón de `repositorios/animales.ts`:

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import type { Asiento, Caso, FiltroCasos, Intencion, RepositorioFinanzas, SaldoDelCaso } from "@/domains/finanzas/tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

export function repositorioFinanzasPrisma(cliente: ClienteBase = clientePorDefecto): RepositorioFinanzas {
  return {
    async crearCaso(datos) {
      return (await cliente.casoFinanciero.create({ data: datos as never })) as unknown as Caso;
    },
    async actualizarCaso(id, cambios) {
      return (await cliente.casoFinanciero.update({ where: { id }, data: cambios as never })) as unknown as Caso;
    },
    async casoPorId(id) {
      return (await cliente.casoFinanciero.findUnique({ where: { id } })) as unknown as Caso | null;
    },
    async casoPorSlug(slug) {
      return (await cliente.casoFinanciero.findUnique({ where: { slug } })) as unknown as Caso | null;
    },
    async slugsDeCasos() {
      const filas = await cliente.casoFinanciero.findMany({ select: { slug: true } });
      return filas.map((f) => f.slug);
    },
    async listarCasos(filtro: FiltroCasos) {
      return (await cliente.casoFinanciero.findMany({
        where: {
          estado: filtro.estado,
          ...(filtro.soloAbiertos ? { estado: { not: "CERRADO" } } : {}),
        },
        orderBy: [{ creadoEn: "desc" }],
      })) as unknown as Caso[];
    },

    async crearAsiento(datos) {
      return (await cliente.asientoContable.create({ data: datos as never })) as unknown as Asiento;
    },
    async asientosDeCaso(casoId) {
      return (await cliente.asientoContable.findMany({
        where: { casoId },
        orderBy: [{ fechaEfectiva: "asc" }, { creadoEn: "asc" }],
      })) as unknown as Asiento[];
    },

    /**
     * La suma la hace la base, no la aplicación: un caso viral puede tener
     * miles de asientos y traerlos todos para sumarlos en memoria sería
     * lento y, con el tiempo, imposible.
     */
    async saldoDeCaso(casoId) {
      const [entradas, salidas, donaciones] = await Promise.all([
        cliente.asientoContable.aggregate({ where: { casoId, centavos: { gt: 0 } }, _sum: { centavos: true } }),
        cliente.asientoContable.aggregate({ where: { casoId, centavos: { lt: 0 } }, _sum: { centavos: true } }),
        cliente.asientoContable.count({ where: { casoId, tipo: "DONACION" } }),
      ]);
      const recibidoCentavos = entradas._sum.centavos ?? 0n;
      const negativo = salidas._sum.centavos ?? 0n;
      return {
        recibidoCentavos,
        gastadoCentavos: negativo < 0n ? -negativo : 0n,
        cantidadDonaciones: donaciones,
      } satisfies SaldoDelCaso;
    },

    async asientoPorPagoExterno(proveedor, pagoExternoId) {
      return (await cliente.asientoContable.findFirst({
        where: { proveedor, pagoExternoId },
      })) as unknown as Asiento | null;
    },

    async crearIntencion(datos) {
      return (await cliente.intencionDonacion.create({ data: datos as never })) as unknown as Intencion;
    },
    async intencionPorId(id) {
      return (await cliente.intencionDonacion.findUnique({ where: { id } })) as unknown as Intencion | null;
    },
    async actualizarIntencion(id, cambios) {
      return (await cliente.intencionDonacion.update({ where: { id }, data: cambios as never })) as unknown as Intencion;
    },
    async intencionesPendientes() {
      return (await cliente.intencionDonacion.findMany({
        where: { estado: "PENDIENTE_VERIFICACION" },
        orderBy: [{ creadoEn: "asc" }],
      })) as unknown as Intencion[];
    },
  };
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/integracion/finanzas-repositorio.test.ts`
Esperado: PASAN las 3.

- [ ] **Paso 5: Confirmar**

```bash
git add src/infra/repositorios/finanzas.ts tests/integracion/finanzas-repositorio.test.ts
git commit -m "feat: repositorio Prisma de finanzas

La suma de saldos la hace la base: un caso viral puede tener miles de
asientos y traerlos todos para sumarlos en memoria no escala."
```

---

## Tarea 9: Consultas públicas y componentes de dinero

**Archivos:**
- Crear: `src/domains/finanzas/consultas.ts`, `src/ui/finanzas/Importe.tsx`, `src/ui/finanzas/Medidor.tsx`, más sus módulos CSS
- Prueba: `tests/unidad/finanzas-consultas.test.ts`, `tests/unidad/finanzas-componentes.test.ts`

**Interfaces:**
- Consume: `repositorioFinanzasPrisma`, `formatearCentavos`.
- Produce: `casosPublicos(filtro)`, `casoPorSlug(slug)`, `libroDeCaso(casoId)`, `pendienteDeCaso(casoId)`, `totalesGenerales()`, `porcentajeDeAvance(caso)`, `faltaParaLaMeta(caso)`, `excedente(caso)`, `<Importe>`, `<Medidor>`.

- [ ] **Paso 1: Escribir la prueba del cálculo que se muestra**

Crear `tests/unidad/finanzas-consultas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { porcentajeDeAvance, faltaParaLaMeta, excedente } from "@/domains/finanzas/consultas";

const caso = (recibido: bigint, meta: bigint) => ({ recibidoCentavos: recibido, metaCentavos: meta });

describe("porcentajeDeAvance", () => {
  it("calcula el avance con un decimal", () => {
    expect(porcentajeDeAvance(caso(32750000n, 50000000n))).toBe(65.5);
  });

  it("no pasa de 100 aunque haya excedente: la barra no se desborda", () => {
    expect(porcentajeDeAvance(caso(62000000n, 50000000n))).toBe(100);
  });

  it("una meta de cero no rompe la división", () => {
    expect(porcentajeDeAvance(caso(1000n, 0n))).toBe(100);
  });
});

describe("faltaParaLaMeta", () => {
  it("dice cuánto falta", () => {
    expect(faltaParaLaMeta(caso(32750000n, 50000000n))).toBe(17250000n);
  });

  it("cuando ya se alcanzó, no falta nada: nunca un número negativo", () => {
    expect(faltaParaLaMeta(caso(62000000n, 50000000n))).toBe(0n);
  });
});

describe("excedente", () => {
  it("es cero mientras no se alcanzó la meta", () => {
    expect(excedente(caso(32750000n, 50000000n))).toBe(0n);
  });

  it("es lo que pasó de la meta", () => {
    expect(excedente(caso(62000000n, 50000000n))).toBe(12000000n);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/finanzas-consultas.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar las consultas**

Crear `src/domains/finanzas/consultas.ts`:

```ts
import { unstable_cache } from "next/cache";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { totalPendienteDeVerificar } from "./donaciones";
import type { Asiento, Caso, FiltroCasos } from "./tipos";

type ConMetaYRecibido = Pick<Caso, "recibidoCentavos" | "metaCentavos">;

/** Se acota a 100 para que la barra no se desborde cuando hay excedente. */
export function porcentajeDeAvance(caso: ConMetaYRecibido): number {
  if (caso.metaCentavos <= 0n) return 100;
  const crudo = (Number(caso.recibidoCentavos) / Number(caso.metaCentavos)) * 100;
  return Math.min(100, Math.round(crudo * 10) / 10);
}

/** Nunca negativo: "faltan -$120.000" no significa nada para quien lee. */
export function faltaParaLaMeta(caso: ConMetaYRecibido): bigint {
  const falta = caso.metaCentavos - caso.recibidoCentavos;
  return falta > 0n ? falta : 0n;
}

export function excedente(caso: ConMetaYRecibido): bigint {
  const sobra = caso.recibidoCentavos - caso.metaCentavos;
  return sobra > 0n ? sobra : 0n;
}

export const casosPublicos = unstable_cache(
  async (filtro: FiltroCasos): Promise<Caso[]> => repositorioFinanzasPrisma().listarCasos(filtro),
  ["casos-publicos"],
  { tags: ["casos"] }
);

export const casoPorSlug = unstable_cache(
  async (slug: string): Promise<Caso | null> => repositorioFinanzasPrisma().casoPorSlug(slug),
  ["caso-por-slug"],
  { tags: ["casos"] }
);

export const libroDeCaso = unstable_cache(
  async (casoId: string): Promise<Asiento[]> => repositorioFinanzasPrisma().asientosDeCaso(casoId),
  ["libro-de-caso"],
  { tags: ["casos"] }
);

/**
 * Lo pendiente de verificar se muestra aparte y nunca sumado. Vive acá, entre
 * las lecturas del dominio, para que ninguna página tenga que hablar con el
 * repositorio: esa es la regla que verifica la prueba de invariantes.
 */
export const pendienteDeCaso = unstable_cache(
  async (casoId: string): Promise<bigint> => totalPendienteDeVerificar(casoId, repositorioFinanzasPrisma()),
  ["pendiente-de-caso"],
  { tags: ["casos"] }
);

export interface TotalesGenerales {
  recibidoCentavos: bigint;
  gastadoCentavos: bigint;
  saldoCentavos: bigint;
  casosAbiertos: number;
  casosCerrados: number;
}

export const totalesGenerales = unstable_cache(
  async (): Promise<TotalesGenerales> => {
    const casos = await repositorioFinanzasPrisma().listarCasos({});
    let recibidoCentavos = 0n;
    let gastadoCentavos = 0n;
    let casosAbiertos = 0;
    let casosCerrados = 0;
    for (const caso of casos) {
      recibidoCentavos += caso.recibidoCentavos;
      gastadoCentavos += caso.gastadoCentavos;
      if (caso.estado === "CERRADO") casosCerrados++;
      else casosAbiertos++;
    }
    return { recibidoCentavos, gastadoCentavos, saldoCentavos: recibidoCentavos - gastadoCentavos, casosAbiertos, casosCerrados };
  },
  ["totales-generales"],
  { tags: ["casos"] }
);
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/finanzas-consultas.test.ts`
Esperado: PASAN las 7.

- [ ] **Paso 5: Escribir la prueba de las reglas visuales del dinero**

Crear `tests/unidad/finanzas-componentes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = "src/ui/finanzas";
const hojas = () => readdirSync(dir).filter((f) => f.endsWith(".module.css"));
const contenido = (archivo: string) => readFileSync(path.join(dir, archivo), "utf8");

describe("reglas visuales del dinero", () => {
  it("ningún componente escribe un color literal", () => {
    for (const hoja of hojas()) {
      expect(contenido(hoja).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toHaveLength(0);
    }
  });

  it("los ingresos usan el verde contable y los egresos el rojo, no el naranja", () => {
    const importe = contenido("Importe.module.css");
    expect(importe).toMatch(/var\(--ok\)/);
    expect(importe).toMatch(/var\(--bad\)/);
    expect(importe, "el naranja está reservado a las acciones de donar").not.toMatch(/var\(--accent\)/);
  });

  it("la barra de recaudación sí usa el naranja: es la señal del dinero", () => {
    expect(contenido("Medidor.module.css")).toMatch(/var\(--accent\)/);
  });

  it("los importes van en monoespaciada con cifras alineadas", () => {
    expect(contenido("Importe.module.css")).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});
```

- [ ] **Paso 6: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/finanzas-componentes.test.ts`
Esperado: FALLA — el directorio no existe.

- [ ] **Paso 7: Implementar los componentes**

Crear `src/ui/finanzas/Importe.tsx`:

```tsx
import { formatearCentavos } from "@/domains/finanzas/dinero";
import estilos from "./Importe.module.css";

/**
 * El signo y el color los pone acá, no el formateador: el mismo importe se
 * muestra sin signo en un total y con signo en el libro.
 */
export function Importe({
  centavos,
  conSigno = false,
  tamano = "normal",
}: {
  centavos: bigint;
  conSigno?: boolean;
  tamano?: "normal" | "grande";
}) {
  const entra = centavos > 0n;
  const clases = [estilos.importe, tamano === "grande" ? estilos.grande : "", conSigno ? (entra ? estilos.entra : estilos.sale) : ""]
    .join(" ")
    .trim();

  return (
    <span className={clases}>
      {conSigno ? (entra ? "+" : "−") : ""}
      {formatearCentavos(centavos)}
    </span>
  );
}
```

Crear `src/ui/finanzas/Importe.module.css`:

```css
.importe {
  font-family: var(--fuente-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  font-weight: 500;
  letter-spacing: -0.02em;
}
.grande {
  font-size: 2.375rem;
  letter-spacing: -0.045em;
  line-height: 1;
}
/* Verde y rojo son los colores del libro contable. El naranja queda
   reservado a las acciones de donar: si algo está en naranja, es un botón. */
.entra {
  color: var(--ok);
}
.sale {
  color: var(--bad);
}
```

Crear `src/ui/finanzas/Medidor.tsx`:

```tsx
import { Importe } from "./Importe";
import estilos from "./Medidor.module.css";

export function Medidor({
  recibidoCentavos,
  metaCentavos,
  avance,
  falta,
  cantidadDonaciones,
}: {
  recibidoCentavos: bigint;
  metaCentavos: bigint;
  avance: number;
  falta: bigint;
  cantidadDonaciones: number;
}) {
  return (
    <div className={estilos.medidor}>
      <Importe centavos={recibidoCentavos} tamano="grande" />

      <div
        className={estilos.riel}
        role="progressbar"
        aria-valuenow={avance}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance de la recaudación"
      >
        <div className={estilos.relleno} style={{ width: `${avance}%` }} />
      </div>

      <div className={estilos.pie}>
        <span>
          Meta <Importe centavos={metaCentavos} />
        </span>
        <span>
          {falta > 0n ? <>Faltan <Importe centavos={falta} /></> : "Meta alcanzada"} ·{" "}
          {/* Son donaciones, no personas: sin pedir identificación no hay forma
              de saber si dos vinieron de la misma. */}
          {cantidadDonaciones} {cantidadDonaciones === 1 ? "donación" : "donaciones"}
        </span>
      </div>
    </div>
  );
}
```

Crear `src/ui/finanzas/Medidor.module.css`, portando `.meter` del prototipo:

```css
.medidor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.riel {
  height: 7px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 999px;
  overflow: hidden;
}
/* La barra de recaudación sí lleva el naranja: es la señal del dinero. */
.relleno {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 1.1s cubic-bezier(0.22, 0.8, 0.3, 1);
}
.pie {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 14px;
  flex-wrap: wrap;
  font-size: var(--step--1);
  color: var(--ink-2);
}
@media (prefers-reduced-motion: reduce) {
  .relleno {
    transition: none;
  }
}
```

- [ ] **Paso 8: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/finanzas-componentes.test.ts`
Esperado: PASAN las 4.

- [ ] **Paso 9: Confirmar**

```bash
git add src/domains/finanzas/consultas.ts src/ui/finanzas tests/unidad/finanzas-consultas.test.ts tests/unidad/finanzas-componentes.test.ts
git commit -m "feat: consultas públicas y componentes de dinero"
```

---

## Tarea 10: Páginas públicas del caso y de transparencia

**Archivos:**
- Crear: `src/app/ayudar/page.tsx`, `src/app/ayudar/[slug]/page.tsx`, `src/app/ayudar/[slug]/Pestanas.tsx`, `src/app/ayudar/[slug]/opengraph-image.tsx`, `src/app/transparencia/page.tsx`
- Modificar: `src/app/sitemap.ts`

**Interfaces:**
- Consume: `casosPublicos`, `casoPorSlug`, `libroDeCaso`, `totalesGenerales`, `<Importe>`, `<Medidor>`.
- Produce: las rutas públicas `/ayudar`, `/ayudar/[slug]`, `/transparencia`.

- [ ] **Paso 1: El caso, con su dirección permanente**

Crear `src/app/ayudar/[slug]/page.tsx` siguiendo el patrón de `adopcion/[slug]/page.tsx`, incluida la redirección de direcciones viejas:

```tsx
import { notFound } from "next/navigation";
import { casoPorSlug, libroDeCaso, pendienteDeCaso, porcentajeDeAvance, faltaParaLaMeta } from "@/domains/finanzas/consultas";
import { Medidor } from "@/ui/finanzas/Medidor";
import { Pestanas } from "./Pestanas";

export async function generateStaticParams() {
  const { casosPublicos } = await import("@/domains/finanzas/consultas");
  const casos = await casosPublicos({});
  return casos.map((c) => ({ slug: c.slug }));
}

export default async function Caso({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caso = await casoPorSlug(slug);
  if (!caso) notFound();

  const asientos = await libroDeCaso(caso.id);
  const pendiente = await pendienteDeCaso(caso.id);

  // El orden lo fija la §6.1 del sistema de diseño: quién es, qué le pasó,
  // cómo ayudo. Responder las tres antes de cualquier scroll.
  return (
    <main>
      <h1>{caso.titulo}</h1>
      <p>{caso.situacion}</p>
      <Medidor
        recibidoCentavos={caso.recibidoCentavos}
        metaCentavos={caso.metaCentavos}
        avance={porcentajeDeAvance(caso)}
        falta={faltaParaLaMeta(caso)}
        cantidadDonaciones={caso.cantidadDonantes}
      />
      {/* El botón de donar llega en la tarea 16; hasta entonces, el CBU. */}
      <Pestanas caso={caso} asientos={asientos} pendienteCentavos={pendiente} />
    </main>
  );
}
```

- [ ] **Paso 2: Las cuatro pestañas**

Crear `src/app/ayudar/[slug]/Pestanas.tsx`, portando `.subtabs` del prototipo:

```tsx
"use client";

import { useState } from "react";
import { Importe } from "@/ui/finanzas/Importe";
import type { Asiento, Caso } from "@/domains/finanzas/tipos";
import estilos from "./Pestanas.module.css";

const PESTANAS = [
  { id: "resumen", etiqueta: "Resumen" },
  { id: "gastos", etiqueta: "Gastos" },
  { id: "libro", etiqueta: "Libro contable" },
] as const;

type IdPestana = (typeof PESTANAS)[number]["id"];

const FECHA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" });

export function Pestanas({
  caso,
  asientos,
  pendienteCentavos,
}: {
  caso: Caso;
  asientos: Asiento[];
  pendienteCentavos: bigint;
}) {
  const [activa, setActiva] = useState<IdPestana>("resumen");
  const gastos = asientos.filter((a) => a.tipo === "GASTO");
  const saldo = caso.recibidoCentavos - caso.gastadoCentavos;

  return (
    <section>
      <div className={estilos.pestanas} role="tablist" aria-label="Secciones del caso">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            role="tab"
            id={`pestana-${p.id}`}
            aria-selected={activa === p.id}
            aria-controls={`panel-${p.id}`}
            className={activa === p.id ? estilos.activa : estilos.pestana}
            onClick={() => setActiva(p.id)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {activa === "resumen" && (
        <div role="tabpanel" id="panel-resumen" aria-labelledby="pestana-resumen" className={estilos.panel}>
          <h2>¿En qué se usó la plata?</h2>
          <dl className={estilos.resumen}>
            <div>
              <dt>Dinero recibido y verificado</dt>
              <dd><Importe centavos={caso.recibidoCentavos} conSigno /></dd>
            </div>
            <div>
              <dt>Dinero gastado y documentado</dt>
              <dd><Importe centavos={-caso.gastadoCentavos} conSigno /></dd>
            </div>
            <div>
              <dt>Saldo disponible del caso</dt>
              <dd><Importe centavos={saldo} /></dd>
            </div>
          </dl>

          {pendienteCentavos > 0n && (
            <p className={estilos.pendiente}>
              Hay <Importe centavos={pendienteCentavos} /> en transferencias declaradas que todavía no
              verificamos contra el extracto bancario. <strong>No están contadas</strong> en el total de arriba.
            </p>
          )}
        </div>
      )}

      {activa === "gastos" && (
        <div role="tabpanel" id="panel-gastos" aria-labelledby="pestana-gastos" className={estilos.panel}>
          <h2>Gastos con comprobante</h2>
          {gastos.length === 0 ? (
            <p>Todavía no se registró ningún gasto en este caso.</p>
          ) : (
            <ul className={estilos.lista}>
              {gastos.map((gasto) => (
                <li key={gasto.id}>
                  <div>
                    <strong>{gasto.descripcion}</strong>
                    <span className={estilos.meta}>{FECHA.format(gasto.fechaEfectiva)}</span>
                  </div>
                  <Importe centavos={gasto.centavos} conSigno />
                  {gasto.documentoId ? (
                    <a href={`/documentos/${gasto.documentoId}`}>Ver comprobante</a>
                  ) : (
                    // Un gasto sin respaldo se ve incompleto a propósito.
                    <span className={estilos.sinComprobante}>Sin comprobante adjunto</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activa === "libro" && (
        <div role="tabpanel" id="panel-libro" aria-labelledby="pestana-libro" className={estilos.panel}>
          <h2>Todos los movimientos</h2>
          <p className={estilos.aclaracion}>
            Cada línea es un asiento que no se modifica ni se borra. Si hubo un error, vas a ver la
            corrección como una línea nueva, con su motivo.
          </p>
          <ul className={estilos.lista}>
            {asientos.map((asiento) => (
              <li key={asiento.id}>
                <div>
                  <strong>{asiento.descripcion}</strong>
                  <span className={estilos.meta}>
                    {FECHA.format(asiento.fechaEfectiva)}
                    {asiento.ajustaAId ? " · corrige un movimiento anterior" : ""}
                  </span>
                </div>
                <Importe centavos={asiento.centavos} conSigno />
                <span className={estilos.identificador}>{asiento.id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
```

Crear `src/app/ayudar/[slug]/Pestanas.module.css` portando `.subtabs` del prototipo: subrayado en `var(--mark)` que crece desde la izquierda, y `.pendiente` con `background: var(--warn-soft)` y `color: var(--warn)`.

La pestaña de novedades llega con la entrega 4, que es la que trae las actualizaciones de caso. Hasta entonces son tres.

- [ ] **Paso 3: El bloque que explica el número**

Al pie del caso, el texto de la §6.1: por qué se puede confiar en ese número, en lenguaje llano, contando cuántos movimientos verificados lo componen.

- [ ] **Paso 4: Listado y transparencia**

Crear `src/app/ayudar/page.tsx` con los casos abiertos, y `src/app/transparencia/page.tsx` con los totales, la tabla de casos abiertos y cerrados, y la metodología numerada, escrita sin vocabulario técnico.

- [ ] **Paso 5: Vista previa social y mapa del sitio**

Crear `src/app/ayudar/[slug]/opengraph-image.tsx` siguiendo el de adopción. Agregar los casos a `src/app/sitemap.ts`.

- [ ] **Paso 6: Verificación manual**

Ejecutar `npm run dev`. Crear un caso a mano en la base, registrar dos donaciones y un gasto, y comprobar: el medidor muestra el avance, el libro lista los tres movimientos, el resumen cuadra, y la ficha responde en `/ayudar/<slug>`.

- [ ] **Paso 7: Confirmar**

```bash
git add src/app/ayudar src/app/transparencia src/app/sitemap.ts
git commit -m "feat: páginas públicas de casos y transparencia"
```

---

## Tarea 11: Panel de finanzas

**Archivos:**
- Crear: `src/app/panel/(protegido)/finanzas/page.tsx`, `finanzas/casos/[id]/page.tsx`, `finanzas/acciones.ts`, `finanzas/transferencias/page.tsx`
- Prueba: manual (paso 5)

**Interfaces:**
- Consume: todo el dominio finanzas.
- Produce: acciones de servidor `accionCrearCaso`, `accionRegistrarGasto`, `accionVerificarTransferencia`, `accionRechazarTransferencia`, `accionRegistrarAjuste`, `accionTrasladar`.

- [ ] **Paso 1: El contexto de finanzas para las acciones**

Crear `src/app/panel/(protegido)/finanzas/acciones.ts`, siguiendo el patrón de `animales/acciones.ts`:

```ts
"use server";

import { revalidateTag } from "next/cache";
import { auth } from "@/infra/auth";
import { prisma } from "@/infra/prisma";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { registrarGasto } from "@/domains/finanzas/asientos";
import { verificarTransferencia, rechazarTransferencia } from "@/domains/finanzas/donaciones";
import type { ContextoFinanzas } from "@/domains/finanzas/tipos";

async function conContextoFinanzas<T>(fn: (ctx: ContextoFinanzas) => Promise<T>): Promise<T> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  return prisma.$transaction(async (tx) =>
    fn({
      usuarioEmail: sesion.user.email!,
      rol: sesion.user.rol as ContextoFinanzas["rol"],
      repositorio: repositorioFinanzasPrisma(tx),
      auditoria: auditoriaPrisma(tx),
    })
  );
}

export async function accionRegistrarGasto(formulario: FormData) {
  await conContextoFinanzas((ctx) =>
    registrarGasto(
      {
        casoId: String(formulario.get("casoId") ?? ""),
        // El formulario recibe pesos; la base guarda centavos enteros.
        centavos: BigInt(Math.round(Number(formulario.get("pesos") ?? 0) * 100)),
        descripcion: String(formulario.get("descripcion") ?? ""),
        documentoId: (formulario.get("documentoId") as string) || null,
        fechaEfectiva: new Date(String(formulario.get("fecha"))),
      },
      ctx
    )
  );
  // Sin esto el importe público queda viejo, que es justo donde la
  // transparencia se rompe.
  revalidateTag("casos");
}

export async function accionVerificarTransferencia(intencionId: string) {
  await conContextoFinanzas((ctx) => verificarTransferencia(intencionId, ctx));
  revalidateTag("casos");
}

export async function accionRechazarTransferencia(intencionId: string, motivo: string) {
  await conContextoFinanzas((ctx) => rechazarTransferencia(intencionId, motivo, ctx));
  revalidateTag("casos");
}
```

- [ ] **Paso 2: Alta y edición del caso, con el campo bloqueado**

Crear `finanzas/casos/[id]/page.tsx` con la meta editable y el **recaudado en solo lectura**, usando el componente `CampoCalculado` que ya existe de la entrega 1, con el ícono de candado y la explicación de cuántos movimientos lo componen.

- [ ] **Paso 3: Bandeja de transferencias pendientes**

Crear `finanzas/transferencias/page.tsx`: lista de intenciones pendientes con importe, comprobante, y los botones de verificar y rechazar. El rechazo pide motivo antes de ejecutarse.

Arriba de la lista, el total pendiente con la leyenda **"no computado al total público"** en ámbar.

- [ ] **Paso 4: Gastos y ajustes**

Formulario de gasto con importe, descripción, fecha y comprobante. El de ajuste exige motivo y respaldo, y aclara en pantalla que el ajuste queda publicado en el libro del caso.

- [ ] **Paso 5: Verificación manual**

1. Crear un caso. El recaudado se ve bloqueado con candado.
2. Registrar un gasto → aparece en el libro público y el saldo cambia.
3. Declarar una transferencia desde el sitio público → aparece en la bandeja, en ámbar, sin sumar al total.
4. Verificarla → suma al total y desaparece de la bandeja.
5. Consultar `SELECT accion FROM "RegistroAuditoria" ORDER BY "creadoEn" DESC LIMIT 5` → hay una fila por cada acción.

- [ ] **Paso 6: Confirmar**

```bash
git add "src/app/panel/(protegido)/finanzas"
git commit -m "feat: panel de finanzas con transferencias, gastos y ajustes"
```

---

# Mitad 2B — Los pagos

## Tarea 12: El puerto del proveedor de pagos

**Archivos:**
- Crear: `src/domains/pagos/tipos.ts`, `tests/dobles/proveedor-pagos-falso.ts`

**Interfaces:**
- Consume: nada.
- Produce: `ProveedorDePagos`, `EstadoDePago`, `proveedorFalso()`.

- [ ] **Paso 1: Definir el puerto**

Crear `src/domains/pagos/tipos.ts`:

```ts
export type EstadoDePago = "aprobado" | "pendiente" | "rechazado" | "inexistente";

export interface PagoConsultado {
  estado: EstadoDePago;
  centavos: bigint;
  /** El identificador de la intención que viajó como referencia externa. */
  referenciaExterna: string | null;
}

export interface DatosDePreferencia {
  intencionId: string;
  titulo: string;
  centavos: bigint;
  moneda: string;
  urlRetorno: string;
  urlAviso: string;
}

export interface PreferenciaCreada {
  referenciaExterna: string;
  urlDePago: string;
}

/**
 * El dominio habla con este puerto, nunca con Mercado Pago. Así las pruebas
 * corren sin red y agregar otro proveedor no toca ninguna regla de negocio.
 */
export interface ProveedorDePagos {
  readonly nombre: string;
  crearPreferencia(datos: DatosDePreferencia): Promise<PreferenciaCreada>;
  /** Se consulta contra la API del proveedor. Nunca se cree lo que dice el aviso. */
  consultarPago(pagoExternoId: string): Promise<PagoConsultado>;
}
```

- [ ] **Paso 2: Crear el doble**

Crear `tests/dobles/proveedor-pagos-falso.ts`:

```ts
import type { PagoConsultado, ProveedorDePagos } from "@/domains/pagos/tipos";

export function proveedorFalso(pagos: Record<string, PagoConsultado> = {}) {
  const preferencias: string[] = [];
  const consultas: string[] = [];

  const proveedor: ProveedorDePagos = {
    nombre: "falso",
    async crearPreferencia(datos) {
      preferencias.push(datos.intencionId);
      return { referenciaExterna: `pref-${datos.intencionId}`, urlDePago: `https://pago.falso/${datos.intencionId}` };
    },
    async consultarPago(pagoExternoId) {
      consultas.push(pagoExternoId);
      return pagos[pagoExternoId] ?? { estado: "inexistente", centavos: 0n, referenciaExterna: null };
    },
  };

  return Object.assign(proveedor, { preferencias, consultas });
}
```

- [ ] **Paso 3: Verificar que compila**

Ejecutar: `npx tsc --noEmit`
Esperado: sin errores.

- [ ] **Paso 4: Confirmar**

```bash
git add src/domains/pagos/tipos.ts tests/dobles/proveedor-pagos-falso.ts
git commit -m "feat: puerto del proveedor de pagos

El dominio habla con el puerto, nunca con Mercado Pago: las pruebas
corren sin red."
```

---

## Tarea 13: Procesar el aviso — idempotencia y verificación

Esta tarea es el corazón de la mitad 2B.

**Archivos:**
- Crear: `src/domains/pagos/procesar-aviso.ts`
- Prueba: `tests/unidad/pagos-procesar-aviso.test.ts`

**Interfaces:**
- Consume: `ProveedorDePagos`, `RepositorioFinanzas`, `registrarAsiento`.
- Produce: `procesarAviso(aviso, ctx): Promise<ResultadoAviso>`, `type ResultadoAviso`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/pagos-procesar-aviso.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { procesarAviso } from "@/domains/pagos/procesar-aviso";
import { crearCaso } from "@/domains/finanzas/casos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import { proveedorFalso } from "../dobles/proveedor-pagos-falso";

const base = {
  titulo: "Luna — cirugía",
  situacion: "La atropellaron en Provincias Unidas y necesita cirugía de cadera.",
  metaCentavos: 50000000n,
};

async function escenario(estadoDelPago: "aprobado" | "rechazado" | "pendiente" | "inexistente" = "aprobado") {
  const repositorio = repositorioFinanzasEnMemoria();
  const auditoria = auditoriaEnMemoria();
  const ctxAlta = { usuarioEmail: "carla@huellas.org.ar", rol: "FINANZAS" as const, repositorio, auditoria };
  const caso = await crearCaso(base, ctxAlta);

  const intencion = await repositorio.crearIntencion({
    casoId: caso.id,
    centavos: 2500000n,
    moneda: "ARS",
    nombreDonante: "Marina",
    publicarNombre: true,
    mensaje: null,
    proveedor: "mercadopago",
    estado: "INICIADA",
    referenciaExterna: "pref-1",
    pagoExternoId: null,
    comprobanteId: null,
  });

  const proveedor = proveedorFalso({
    "1327884391": { estado: estadoDelPago, centavos: 2500000n, referenciaExterna: intencion.id },
  });

  return { repositorio, auditoria, proveedor, caso, intencion };
}

function contextoAviso(e: Awaited<ReturnType<typeof escenario>>) {
  return { repositorio: e.repositorio, auditoria: e.auditoria, proveedor: e.proveedor };
}

describe("procesarAviso", () => {
  it("un pago aprobado crea el asiento y mueve el total", async () => {
    const e = await escenario("aprobado");
    const resultado = await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));

    expect(resultado.tipo).toBe("asentado");
    expect((await e.repositorio.casoPorId(e.caso.id))!.recibidoCentavos).toBe(2500000n);
    expect((await e.repositorio.intencionPorId(e.intencion.id))!.estado).toBe("APROBADA");
  });

  it("nunca se cree el aviso: consulta al proveedor antes de asentar", async () => {
    const e = await escenario("aprobado");
    await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));
    expect(e.proveedor.consultas).toContain("1327884391");
  });

  it("un pago rechazado no crea asiento", async () => {
    const e = await escenario("rechazado");
    const resultado = await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));

    expect(resultado.tipo).toBe("no-aprobado");
    expect((await e.repositorio.casoPorId(e.caso.id))!.recibidoCentavos).toBe(0n);
    expect((await e.repositorio.intencionPorId(e.intencion.id))!.estado).toBe("RECHAZADA");
  });

  it("un pago pendiente no crea asiento y deja la intención como estaba", async () => {
    const e = await escenario("pendiente");
    const resultado = await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));

    expect(resultado.tipo).toBe("no-aprobado");
    expect((await e.repositorio.intencionPorId(e.intencion.id))!.estado).toBe("INICIADA");
  });

  it("un pago que el proveedor no conoce se informa para reintentar", async () => {
    const e = await escenario("inexistente");
    const resultado = await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));
    expect(resultado.tipo).toBe("reintentar");
  });

  it("dos avisos sobre el mismo pago generan un solo asiento", async () => {
    const e = await escenario("aprobado");
    await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));
    const segundo = await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));

    expect(segundo.tipo).toBe("ya-procesado");
    expect((await e.repositorio.casoPorId(e.caso.id))!.recibidoCentavos).toBe(2500000n);
    expect(e.repositorio.asientos).toHaveLength(1);
  });

  it("el importe asentado es el que informa el proveedor, no el de la intención", async () => {
    const e = await escenario("aprobado");
    // Alguien manipuló la intención después de crearla; manda lo que se pagó.
    await e.repositorio.actualizarIntencion(e.intencion.id, { centavos: 99999999n });
    await procesarAviso({ pagoExternoId: "1327884391" }, contextoAviso(e));
    expect((await e.repositorio.casoPorId(e.caso.id))!.recibidoCentavos).toBe(2500000n);
  });

  it("un pago sin intención conocida no inventa un caso", async () => {
    const e = await escenario("aprobado");
    const proveedor = proveedorFalso({
      "999": { estado: "aprobado", centavos: 100n, referenciaExterna: "intencion-que-no-existe" },
    });
    const resultado = await procesarAviso({ pagoExternoId: "999" }, { ...contextoAviso(e), proveedor });
    expect(resultado.tipo).toBe("sin-intencion");
    expect(e.repositorio.asientos).toHaveLength(0);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/pagos-procesar-aviso.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/pagos/procesar-aviso.ts`:

```ts
import { registrarAsiento } from "@/domains/finanzas/asientos";
import type { PuertoAuditoria } from "@/domains/animales/tipos";
import type { RepositorioFinanzas } from "@/domains/finanzas/tipos";
import type { ProveedorDePagos } from "./tipos";

export interface Aviso {
  pagoExternoId: string;
}

export interface ContextoAviso {
  repositorio: RepositorioFinanzas;
  auditoria: PuertoAuditoria;
  proveedor: ProveedorDePagos;
}

export type ResultadoAviso =
  | { tipo: "asentado"; asientoId: string }
  | { tipo: "ya-procesado" }
  | { tipo: "no-aprobado"; estado: string }
  | { tipo: "sin-intencion" }
  | { tipo: "reintentar"; razon: string };

/**
 * Convierte un aviso del proveedor en un asiento, si corresponde.
 *
 * El aviso solo aporta el número de pago. El estado y el importe se consultan
 * contra la API del proveedor con nuestro propio token: un aviso falsificado
 * no puede inventar plata.
 */
export async function procesarAviso(aviso: Aviso, ctx: ContextoAviso): Promise<ResultadoAviso> {
  // Primera barrera contra el doble conteo: si ya hay asiento para este pago,
  // no se vuelve a asentar. Hace falta además de la deduplicación de avisos
  // porque el proveedor manda avisos distintos sobre el mismo pago cuando
  // cambia de estado, y esos son legítimos.
  const yaAsentado = await ctx.repositorio.asientoPorPagoExterno(ctx.proveedor.nombre, aviso.pagoExternoId);
  if (yaAsentado) return { tipo: "ya-procesado" };

  const pago = await ctx.proveedor.consultarPago(aviso.pagoExternoId);

  if (pago.estado === "inexistente") {
    // Si la firma era válida, el aviso vino del proveedor y ese pago existe:
    // que la API todavía no lo devuelva es una carrera con su propagación
    // interna, no un pago inventado. Conviene reintentar.
    return { tipo: "reintentar", razon: "el proveedor todavía no devuelve ese pago" };
  }

  if (!pago.referenciaExterna) return { tipo: "sin-intencion" };
  const intencion = await ctx.repositorio.intencionPorId(pago.referenciaExterna);
  if (!intencion) return { tipo: "sin-intencion" };

  if (pago.estado !== "aprobado") {
    if (pago.estado === "rechazado") {
      await ctx.repositorio.actualizarIntencion(intencion.id, { estado: "RECHAZADA", resueltoEn: new Date(), pagoExternoId: aviso.pagoExternoId });
    }
    return { tipo: "no-aprobado", estado: pago.estado };
  }

  const asiento = await registrarAsiento(
    {
      casoId: intencion.casoId,
      tipo: "DONACION",
      // El importe es el que informa el proveedor, no el de la intención: lo
      // que vale es lo que efectivamente se pagó.
      centavos: pago.centavos,
      descripcion: "Donación verificada contra el proveedor de pagos",
      proveedor: ctx.proveedor.nombre,
      pagoExternoId: aviso.pagoExternoId,
      intencionId: intencion.id,
      creadoPorSistema: true,
      fechaEfectiva: new Date(),
    },
    {
      usuarioEmail: "sistema",
      rol: "ADMINISTRACION",
      repositorio: ctx.repositorio,
      auditoria: ctx.auditoria,
    }
  );

  await ctx.repositorio.actualizarIntencion(intencion.id, {
    estado: "APROBADA",
    pagoExternoId: aviso.pagoExternoId,
    resueltoEn: new Date(),
  });

  return { tipo: "asentado", asientoId: asiento.id };
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/pagos-procesar-aviso.test.ts`
Esperado: PASAN las 8.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/pagos/procesar-aviso.ts tests/unidad/pagos-procesar-aviso.test.ts
git commit -m "feat: procesamiento de avisos de pago con verificación

El aviso solo aporta el número de pago: el estado y el importe se
consultan contra la API con nuestro token."
```

---

## Tarea 14: Validación de la firma del aviso

**Archivos:**
- Crear: `src/infra/pagos/firma.ts`
- Prueba: `tests/unidad/pagos-firma.test.ts`

**Interfaces:**
- Consume: `node:crypto`.
- Produce: `firmaValida({ cabeceraFirma, cabeceraPedido, idDelRecurso, secreto }): boolean`

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/pagos-firma.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { firmaValida } from "@/infra/pagos/firma";

const SECRETO = "secreto-de-prueba";
const ID_RECURSO = "1327884391";
const ID_PEDIDO = "req-abc";
const MARCA_TIEMPO = "1757000000";

function firmar(id: string, pedido: string, marca: string, secreto = SECRETO): string {
  const manifiesto = `id:${id};request-id:${pedido};ts:${marca};`;
  return createHmac("sha256", secreto).update(manifiesto).digest("hex");
}

describe("firmaValida", () => {
  it("acepta una firma correcta", () => {
    const v1 = firmar(ID_RECURSO, ID_PEDIDO, MARCA_TIEMPO);
    expect(
      firmaValida({ cabeceraFirma: `ts=${MARCA_TIEMPO},v1=${v1}`, cabeceraPedido: ID_PEDIDO, idDelRecurso: ID_RECURSO, secreto: SECRETO })
    ).toBe(true);
  });

  it("rechaza una firma de otro secreto: es el caso del aviso falsificado", () => {
    const v1 = firmar(ID_RECURSO, ID_PEDIDO, MARCA_TIEMPO, "secreto-del-atacante");
    expect(
      firmaValida({ cabeceraFirma: `ts=${MARCA_TIEMPO},v1=${v1}`, cabeceraPedido: ID_PEDIDO, idDelRecurso: ID_RECURSO, secreto: SECRETO })
    ).toBe(false);
  });

  it("rechaza si cambiaron el número de pago", () => {
    const v1 = firmar(ID_RECURSO, ID_PEDIDO, MARCA_TIEMPO);
    expect(
      firmaValida({ cabeceraFirma: `ts=${MARCA_TIEMPO},v1=${v1}`, cabeceraPedido: ID_PEDIDO, idDelRecurso: "999", secreto: SECRETO })
    ).toBe(false);
  });

  it("rechaza una cabecera con formato inesperado", () => {
    expect(firmaValida({ cabeceraFirma: "cualquier cosa", cabeceraPedido: ID_PEDIDO, idDelRecurso: ID_RECURSO, secreto: SECRETO })).toBe(false);
  });

  it("rechaza si falta la cabecera", () => {
    expect(firmaValida({ cabeceraFirma: null, cabeceraPedido: ID_PEDIDO, idDelRecurso: ID_RECURSO, secreto: SECRETO })).toBe(false);
  });

  it("sin secreto configurado no valida nada: mejor rechazar que aceptar todo", () => {
    const v1 = firmar(ID_RECURSO, ID_PEDIDO, MARCA_TIEMPO);
    expect(
      firmaValida({ cabeceraFirma: `ts=${MARCA_TIEMPO},v1=${v1}`, cabeceraPedido: ID_PEDIDO, idDelRecurso: ID_RECURSO, secreto: "" })
    ).toBe(false);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/pagos-firma.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/infra/pagos/firma.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export interface DatosDeFirma {
  cabeceraFirma: string | null;
  cabeceraPedido: string | null;
  idDelRecurso: string;
  secreto: string;
}

/**
 * Mercado Pago firma cada aviso con un secreto que solo conocen ellos y
 * nosotros. Sin esta validación, cualquiera que descubra la dirección del
 * webhook podría inventar donaciones.
 *
 * La cabecera llega como "ts=<marca>,v1=<firma>", y el manifiesto que se firma
 * es "id:<recurso>;request-id:<pedido>;ts:<marca>;".
 */
export function firmaValida({ cabeceraFirma, cabeceraPedido, idDelRecurso, secreto }: DatosDeFirma): boolean {
  if (!secreto || !cabeceraFirma) return false;

  const partes = Object.fromEntries(
    cabeceraFirma.split(",").map((trozo) => {
      const [clave, valor] = trozo.split("=");
      return [clave?.trim(), valor?.trim()];
    })
  );

  const marca = partes.ts;
  const recibida = partes.v1;
  if (!marca || !recibida) return false;

  const manifiesto = `id:${idDelRecurso};request-id:${cabeceraPedido ?? ""};ts:${marca};`;
  const esperada = createHmac("sha256", secreto).update(manifiesto).digest("hex");

  const a = Buffer.from(esperada, "utf8");
  const b = Buffer.from(recibida, "utf8");
  if (a.length !== b.length) return false;
  // Comparación de tiempo constante: una comparación normal filtra por
  // cuánto tarda en fallar y permite adivinar la firma carácter por carácter.
  return timingSafeEqual(a, b);
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/pagos-firma.test.ts`
Esperado: PASAN las 6.

- [ ] **Paso 5: Confirmar**

```bash
git add src/infra/pagos/firma.ts tests/unidad/pagos-firma.test.ts
git commit -m "feat: validación de la firma de los avisos de Mercado Pago

Sin esto, cualquiera que descubra la dirección del webhook podría
inventar donaciones."
```

---

## Tarea 15: Adaptador de Mercado Pago y ruta del aviso

**Archivos:**
- Crear: `src/infra/pagos/mercadopago.ts`, `src/app/api/webhooks/mercadopago/route.ts`
- Modificar: `.env.example`
- Prueba: `tests/unidad/pagos-mercadopago.test.ts`

**Interfaces:**
- Consume: `ProveedorDePagos`, `firmaValida`, `procesarAviso`.
- Produce: `mercadoPago(): ProveedorDePagos`, la ruta `POST /api/webhooks/mercadopago`.

- [ ] **Paso 1: Instalar el SDK**

```bash
npm install mercadopago
```

- [ ] **Paso 2: Escribir la prueba de la traducción de estados**

Crear `tests/unidad/pagos-mercadopago.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { traducirEstado, aCentavos } from "@/infra/pagos/mercadopago";

describe("traducirEstado", () => {
  it("solo 'approved' cuenta como aprobado", () => {
    expect(traducirEstado("approved")).toBe("aprobado");
  });

  it("los estados intermedios son pendientes, no aprobados", () => {
    expect(traducirEstado("in_process")).toBe("pendiente");
    expect(traducirEstado("pending")).toBe("pendiente");
    expect(traducirEstado("authorized")).toBe("pendiente");
  });

  it("los estados terminales negativos son rechazados", () => {
    expect(traducirEstado("rejected")).toBe("rechazado");
    expect(traducirEstado("cancelled")).toBe("rechazado");
    expect(traducirEstado("refunded")).toBe("rechazado");
    expect(traducirEstado("charged_back")).toBe("rechazado");
  });

  it("un estado que no conocemos nunca se toma por aprobado", () => {
    expect(traducirEstado("estado_futuro_de_mercadopago")).toBe("pendiente");
  });
});

describe("aCentavos", () => {
  it("convierte pesos con decimales a centavos enteros", () => {
    expect(aCentavos(25000)).toBe(2500000n);
    expect(aCentavos(1500.5)).toBe(150050n);
  });

  it("redondea al centavo: no arrastra el error del punto flotante", () => {
    expect(aCentavos(0.1 + 0.2)).toBe(30n);
  });
});
```

- [ ] **Paso 3: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/pagos-mercadopago.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 4: Implementar el adaptador**

Crear `src/infra/pagos/mercadopago.ts`:

```ts
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import type { EstadoDePago, PagoConsultado, ProveedorDePagos } from "@/domains/pagos/tipos";

/**
 * Solo "approved" cuenta. Cualquier estado que no conozcamos se trata como
 * pendiente: ante la duda, no se suma plata al total público.
 */
export function traducirEstado(estado: string): EstadoDePago {
  if (estado === "approved") return "aprobado";
  if (["rejected", "cancelled", "refunded", "charged_back"].includes(estado)) return "rechazado";
  return "pendiente";
}

/** Mercado Pago informa pesos con decimales; la base guarda centavos enteros. */
export function aCentavos(pesos: number): bigint {
  return BigInt(Math.round(pesos * 100));
}

function cliente(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN");
  return new MercadoPagoConfig({ accessToken });
}

export function mercadoPago(): ProveedorDePagos {
  return {
    nombre: "mercadopago",

    async crearPreferencia(datos) {
      const preferencia = await new Preference(cliente()).create({
        body: {
          items: [
            {
              id: datos.intencionId,
              title: datos.titulo,
              quantity: 1,
              unit_price: Number(datos.centavos) / 100,
              currency_id: datos.moneda,
            },
          ],
          // Así vuelve la intención en el aviso: es el hilo que une el pago
          // con el caso y con la preferencia de anonimato.
          external_reference: datos.intencionId,
          back_urls: { success: datos.urlRetorno, failure: datos.urlRetorno, pending: datos.urlRetorno },
          notification_url: datos.urlAviso,
        },
      });

      if (!preferencia.id || !preferencia.init_point) {
        throw new Error("Mercado Pago no devolvió la preferencia");
      }
      return { referenciaExterna: preferencia.id, urlDePago: preferencia.init_point };
    },

    async consultarPago(pagoExternoId): Promise<PagoConsultado> {
      try {
        const pago = await new Payment(cliente()).get({ id: pagoExternoId });
        return {
          estado: traducirEstado(pago.status ?? ""),
          centavos: aCentavos(pago.transaction_amount ?? 0),
          referenciaExterna: pago.external_reference ?? null,
        };
      } catch {
        // Puede ser una carrera con la propagación interna del proveedor:
        // quien llama decide si reintentar.
        return { estado: "inexistente", centavos: 0n, referenciaExterna: null };
      }
    },
  };
}
```

- [ ] **Paso 5: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/pagos-mercadopago.test.ts`
Esperado: PASAN las 6.

- [ ] **Paso 6: Implementar la ruta del aviso**

Crear `src/app/api/webhooks/mercadopago/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/infra/prisma";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { mercadoPago } from "@/infra/pagos/mercadopago";
import { firmaValida } from "@/infra/pagos/firma";
import { procesarAviso } from "@/domains/pagos/procesar-aviso";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";

export async function POST(pedido: Request) {
  const cuerpo = await pedido.json().catch(() => null);
  const idDelRecurso = String(cuerpo?.data?.id ?? "");
  if (!idDelRecurso) return NextResponse.json({ error: "aviso sin recurso" }, { status: 400 });

  if (
    !firmaValida({
      cabeceraFirma: pedido.headers.get("x-signature"),
      cabeceraPedido: pedido.headers.get("x-request-id"),
      idDelRecurso,
      secreto: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
    })
  ) {
    // No vino de Mercado Pago: no se registra ni se procesa.
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  // Segunda barrera de idempotencia: contra el aviso repetido. La clave
  // incluye la acción porque un mismo pago genera avisos legítimos distintos
  // cuando cambia de estado.
  const claveDelAviso = `${cuerpo.type ?? "payment"}:${idDelRecurso}:${cuerpo.action ?? ""}`;
  try {
    await prisma.eventoWebhook.create({
      data: { proveedor: "mercadopago", eventoExternoId: claveDelAviso, cargaUtil: cuerpo },
    });
  } catch {
    // Ya lo habíamos recibido: que deje de reintentar.
    return NextResponse.json({ ok: true, nota: "aviso repetido" });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) =>
      procesarAviso(
        { pagoExternoId: idDelRecurso },
        { repositorio: repositorioFinanzasPrisma(tx), auditoria: auditoriaPrisma(tx), proveedor: mercadoPago() }
      )
    );

    await prisma.eventoWebhook.updateMany({
      where: { proveedor: "mercadopago", eventoExternoId: claveDelAviso },
      data: { procesadoEn: new Date(), resultado: resultado.tipo },
    });

    if (resultado.tipo === "asentado") revalidateTag("casos");

    // Que reintente solo cuando reintentar puede cambiar algo.
    if (resultado.tipo === "reintentar") {
      return NextResponse.json({ error: resultado.razon }, { status: 500 });
    }
    return NextResponse.json({ ok: true, resultado: resultado.tipo });
  } catch (error) {
    // Falla nuestra: que Mercado Pago reintente.
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Paso 7: Documentar las variables**

Agregar a `.env.example`:

```
# Mercado Pago. Empezar con las credenciales de prueba.
MERCADOPAGO_ACCESS_TOKEN=""
MERCADOPAGO_WEBHOOK_SECRET=""
```

- [ ] **Paso 8: Confirmar**

```bash
git add src/infra/pagos src/app/api/webhooks .env.example package.json package-lock.json tests/unidad/pagos-mercadopago.test.ts
git commit -m "feat: adaptador de Mercado Pago y ruta del aviso

Un estado que no conocemos nunca se toma por aprobado: ante la duda, no
se suma plata al total público."
```

---

## Tarea 16: El flujo público de donación

**Archivos:**
- Crear: `src/app/ayudar/[slug]/donar/page.tsx`, `src/app/ayudar/[slug]/donar/acciones.ts`, `src/app/ayudar/[slug]/gracias/page.tsx`
- Modificar: `src/app/ayudar/[slug]/page.tsx` (botón de donar)

**Interfaces:**
- Consume: `mercadoPago()`, `repositorioFinanzasPrisma`, `casoPorSlug`.
- Produce: la acción `accionIniciarDonacion(formulario)`.

- [ ] **Paso 1: El formulario**

Crear `src/app/ayudar/[slug]/donar/page.tsx`: importe (con montos sugeridos), nombre opcional, casilla **"quiero que mi nombre aparezca en el caso"** —desmarcada por defecto— y mensaje opcional.

La casilla va desmarcada por defecto porque publicar un nombre es una decisión activa de la persona, no algo que se asume.

- [ ] **Paso 2: La acción que crea la intención y redirige**

Crear `src/app/ayudar/[slug]/donar/acciones.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { repositorioFinanzasPrisma } from "@/infra/repositorios/finanzas";
import { mercadoPago } from "@/infra/pagos/mercadopago";

export async function accionIniciarDonacion(formulario: FormData) {
  const repositorio = repositorioFinanzasPrisma();
  const slug = String(formulario.get("slug") ?? "");
  const caso = await repositorio.casoPorSlug(slug);
  if (!caso) throw new Error("No existe el caso");

  const pesos = Number(formulario.get("pesos") ?? 0);
  if (!Number.isFinite(pesos) || pesos < 100) {
    throw new Error("El importe mínimo es de $100");
  }

  const nombre = String(formulario.get("nombre") ?? "").trim();
  const intencion = await repositorio.crearIntencion({
    casoId: caso.id,
    centavos: BigInt(Math.round(pesos * 100)),
    moneda: caso.moneda,
    nombreDonante: nombre.length > 0 ? nombre : null,
    // Publicar el nombre es una decisión activa: si no marcó la casilla, no.
    publicarNombre: formulario.get("publicarNombre") === "on",
    mensaje: String(formulario.get("mensaje") ?? "").trim() || null,
    proveedor: "mercadopago",
    estado: "INICIADA",
    referenciaExterna: null,
    pagoExternoId: null,
    comprobanteId: null,
  });

  const base = process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000";
  const preferencia = await mercadoPago().crearPreferencia({
    intencionId: intencion.id,
    titulo: caso.titulo,
    centavos: intencion.centavos,
    moneda: caso.moneda,
    urlRetorno: `${base}/ayudar/${caso.slug}/gracias`,
    urlAviso: `${base}/api/webhooks/mercadopago`,
  });

  await repositorio.actualizarIntencion(intencion.id, { referenciaExterna: preferencia.referenciaExterna });
  redirect(preferencia.urlDePago);
}
```

- [ ] **Paso 3: La vuelta**

Crear `src/app/ayudar/[slug]/gracias/page.tsx`. **No afirma que la donación entró**: el estado real lo define el aviso verificado, que puede tardar. Dice que el pago se está confirmando y que el monto del caso se actualiza solo cuando quede verificado.

Afirmar lo contrario sería mostrar como confirmado algo que todavía no lo está, que es exactamente lo que la plataforma promete no hacer.

- [ ] **Paso 4: Prueba de punta a punta con credenciales de prueba**

Con `MERCADOPAGO_ACCESS_TOKEN` de prueba:

1. Exponer el sitio local con un túnel para que Mercado Pago pueda avisar.
2. Donar con una tarjeta de prueba aprobada → llega el aviso, se crea el asiento, el total sube.
3. Donar con una tarjeta de prueba rechazada → no se crea asiento, la intención queda rechazada.
4. Reenviar el mismo aviso desde el panel de Mercado Pago → responde "aviso repetido" y el total no se mueve.

- [ ] **Paso 5: Confirmar**

```bash
git add "src/app/ayudar"
git commit -m "feat: flujo público de donación por Mercado Pago

La pantalla de vuelta no afirma que la donación entró: el estado real lo
define el aviso verificado."
```

---

## Tarea 17: Invariantes de la entrega 2 y verificación de saldos

**Archivos:**
- Crear: `tests/unidad/finanzas-invariantes.test.ts`, `src/domains/finanzas/verificacion.ts`
- Prueba: `tests/unidad/finanzas-verificacion.test.ts`
- Modificar: `package.json`

**Interfaces:**
- Consume: todo lo anterior.
- Produce: `verificarSaldos(repositorio): Promise<Diferencia[]>`.

- [ ] **Paso 1: Escribir la prueba de la verificación**

Crear `tests/unidad/finanzas-verificacion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { verificarSaldos } from "@/domains/finanzas/verificacion";
import { crearCaso } from "@/domains/finanzas/casos";
import { registrarAsiento } from "@/domains/finanzas/asientos";
import { repositorioFinanzasEnMemoria } from "../dobles/repositorio-finanzas-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

const base = { titulo: "Luna", situacion: "La atropellaron y necesita cirugía de cadera urgente.", metaCentavos: 50000000n };

describe("verificarSaldos", () => {
  it("no informa diferencias cuando todo cuadra", async () => {
    const ctx = { usuarioEmail: "c@h.org", rol: "FINANZAS" as const, repositorio: repositorioFinanzasEnMemoria(), auditoria: auditoriaEnMemoria() };
    const caso = await crearCaso(base, ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000000n, descripcion: "x", fechaEfectiva: new Date() }, ctx);
    expect(await verificarSaldos(ctx.repositorio)).toEqual([]);
  });

  it("detecta un saldo tocado por fuera del sistema", async () => {
    const ctx = { usuarioEmail: "c@h.org", rol: "FINANZAS" as const, repositorio: repositorioFinanzasEnMemoria(), auditoria: auditoriaEnMemoria() };
    const caso = await crearCaso(base, ctx);
    await registrarAsiento({ casoId: caso.id, tipo: "DONACION", centavos: 1000000n, descripcion: "x", fechaEfectiva: new Date() }, ctx);

    // Alguien escribió directo en la base, salteando el dominio.
    await ctx.repositorio.actualizarCaso(caso.id, { recibidoCentavos: 99999999n });

    const diferencias = await verificarSaldos(ctx.repositorio);
    expect(diferencias).toHaveLength(1);
    expect(diferencias[0]).toMatchObject({ casoId: caso.id, guardadoRecibido: 99999999n, calculadoRecibido: 1000000n });
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/finanzas-verificacion.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/finanzas/verificacion.ts`:

```ts
import type { RepositorioFinanzas } from "./tipos";

export interface Diferencia {
  casoId: string;
  slug: string;
  guardadoRecibido: bigint;
  calculadoRecibido: bigint;
  guardadoGastado: bigint;
  calculadoGastado: bigint;
}

/**
 * Compara el saldo guardado en cada caso contra la suma real de sus asientos.
 *
 * Si difieren, alguien tocó la base por fuera del sistema, y eso hay que
 * saberlo el mismo día y no cuando lo note un donante.
 */
export async function verificarSaldos(repositorio: RepositorioFinanzas): Promise<Diferencia[]> {
  const casos = await repositorio.listarCasos({});
  const diferencias: Diferencia[] = [];

  for (const caso of casos) {
    const saldo = await repositorio.saldoDeCaso(caso.id);
    if (saldo.recibidoCentavos !== caso.recibidoCentavos || saldo.gastadoCentavos !== caso.gastadoCentavos) {
      diferencias.push({
        casoId: caso.id,
        slug: caso.slug,
        guardadoRecibido: caso.recibidoCentavos,
        calculadoRecibido: saldo.recibidoCentavos,
        guardadoGastado: caso.gastadoCentavos,
        calculadoGastado: saldo.gastadoCentavos,
      });
    }
  }

  return diferencias;
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/finanzas-verificacion.test.ts`
Esperado: PASAN las 2.

- [ ] **Paso 5: Escribir las invariantes**

Crear `tests/unidad/finanzas-invariantes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function archivosDe(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => path.join(dir, f));
}

describe("invariantes de la entrega 2", () => {
  it("ninguna página ni componente importa el repositorio de finanzas directamente", () => {
    const infractores = archivosDe("src/app")
      .filter((f) => !f.includes("acciones") && !f.includes("api/webhooks") && !f.includes("consultas"))
      .filter((f) => /repositorios\/finanzas/.test(readFileSync(f, "utf8")));
    expect(infractores, `saltean la capa de dominio: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("solo el dominio finanzas escribe los saldos del caso", () => {
    const infractores = [...archivosDe("src/app"), ...archivosDe("src/infra")]
      .filter((f) => !f.includes("repositorios/finanzas"))
      .filter((f) => /recibidoCentavos:\s|gastadoCentavos:\s/.test(readFileSync(f, "utf8")));
    expect(infractores, `escriben saldos fuera del dominio: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("el esquema no tiene ni un solo Float", () => {
    expect(readFileSync("prisma/schema.prisma", "utf8")).not.toMatch(/Float/);
  });

  it("la ruta del aviso valida la firma antes de tocar la base", () => {
    const ruta = readFileSync("src/app/api/webhooks/mercadopago/route.ts", "utf8");
    const posicionFirma = ruta.indexOf("firmaValida");
    const posicionEscritura = ruta.indexOf("eventoWebhook.create");
    expect(posicionFirma).toBeGreaterThan(-1);
    expect(posicionFirma, "la firma se valida después de escribir en la base").toBeLessThan(posicionEscritura);
  });

  it("el adaptador nunca toma un estado desconocido por aprobado", () => {
    const adaptador = readFileSync("src/infra/pagos/mercadopago.ts", "utf8");
    expect(adaptador).toMatch(/return "pendiente"/);
  });
});
```

- [ ] **Paso 6: Ejecutar**

Ejecutar: `npx vitest run tests/unidad/finanzas-invariantes.test.ts`
Esperado: PASAN las 5. Si alguna falla, **no se arregla la prueba**: se arregla el código.

- [ ] **Paso 7: Agregar el atajo y la tarea programada**

En `package.json`:

```json
"verificar:saldos": "tsx scripts/verificar-saldos.ts"
```

Crear `scripts/verificar-saldos.ts`, que llama a `verificarSaldos(repositorioFinanzasPrisma())`, escribe el resultado en el registro de auditoría y sale con código 1 si hay diferencias, para que la tarea programada avise.

- [ ] **Paso 8: Confirmar**

```bash
git add tests/unidad/finanzas-invariantes.test.ts src/domains/finanzas/verificacion.ts scripts package.json
git commit -m "test: invariantes de la entrega 2 y verificación diaria de saldos

Si el saldo guardado difiere de la suma de asientos, alguien tocó la base
por fuera del sistema, y eso hay que saberlo el mismo día."
```

---

## Cobertura de la especificación

| Requisito de la spec | Tarea |
|---|---|
| §1 Dos mitades desplegables | Estructura del plan |
| §3.1 IntencionDonacion | 1, 3 |
| §3.2 Vínculos de asiento e intención | 1, 7 |
| §3.3 Cómo se cuentan los donantes | 5, 8 |
| §4.1 Flujo de la donación | 13, 16 |
| §4.2 Idempotencia en dos capas | 13, 15 |
| §4.3 Respuestas al aviso | 15 |
| §4.4 Transferencia bancaria | 6, 11 |
| §5 Excedente y traslados | 5, 7 |
| §6.1 Página del caso | 10 |
| §6.2 Listado y transparencia | 10 |
| §6.3 Revalidación por etiqueta | 11, 15 |
| §7 Panel de finanzas | 11 |
| §8 Pruebas de invariantes | 17 |
| §9 Verificación diaria de saldos | 17 |
| Diseño §3 Naranja solo para dinero | 9 |
| Diseño §11 Campo calculado bloqueado | 11 |

## Una desviación respecto de la especificación

La §6.1 de la especificación describe **cuatro** pestañas en la página del caso: resumen, gastos, libro contable y **novedades**. Este plan implementa tres.

Las novedades dependen de la entidad `Novedad`, que la entrega 1 ubicó explícitamente en las entregas 3 y 4. Ponerlas acá significaría adelantar ese modelo y su panel de carga, y la especificación de la entrega 2 no los diseñó.

La cuarta pestaña se agrega en la entrega 4, junto con las actualizaciones de caso. No bloquea nada: el recorrido del dinero —entró, se gastó, acá está el comprobante, este es el saldo— queda completo con las tres.

Si preferís tenerla ahora, es una entrega aparte y hay que diseñarla antes.

## Fuera de alcance

Postulaciones de adopción y notificaciones: entregas 3 y 4.
