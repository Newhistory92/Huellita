# Entrega 3 — Postulaciones de adopción: Plan de implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Que la asociación deje de recibir postulaciones por mensaje privado de Facebook y pase a tener una bandeja donde cada postulación tiene estado, historial y respuestas comparables entre sí.

**Arquitectura:** Se sigue el patrón ya establecido en las entregas 1 y 2. El dominio `postulaciones` depende de puertos (`RepositorioPostulaciones`, `PuertoAuditoria`), nunca de Prisma, así que sus pruebas corren en memoria. El envío es público y no exige sesión, igual que la declaración de transferencias de la entrega 2. Cada respuesta guarda el texto de la pregunta tal como se hizo.

**Stack:** El de las entregas anteriores. Ninguna dependencia nueva.

**Spec:** [docs/specs/2026-09-08-entrega-3-postulaciones-design.md](../specs/2026-09-08-entrega-3-postulaciones-design.md)
**Entrega 1:** [docs/specs/2026-09-02-entrega-1-nucleo-adopcion-design.md](../specs/2026-09-02-entrega-1-nucleo-adopcion-design.md)
**Sistema de diseño:** [docs/specs/2026-09-02-sistema-diseno-v1.md](../specs/2026-09-02-sistema-diseno-v1.md)

## Restricciones globales

Aplican a **todas** las tareas.

- **Las páginas y los componentes nunca acceden a la base de datos directamente.** Toda lectura y escritura pasa por una función de dominio.
- **Las postulaciones no tienen página pública, no entran al mapa del sitio y no tienen vista previa social.**
- **Los permisos se verifican en la capa de dominio, no escondiendo botones.** Según la tabla de la §7 de la entrega 1, el rol `FINANZAS` **no tiene ningún acceso** a postulaciones, ni de lectura.
- **La validación corre en el servidor y según el tipo de cada pregunta.** La del navegador es una comodidad, no una garantía.
- **Cada respuesta guarda el texto de la pregunta tal como se hizo.** Editar o archivar una pregunta no cambia lo que dicen las postulaciones viejas.
- **Las preguntas se archivan, no se borran.**
- **La auditoría se escribe en la misma transacción que la acción.**
- **El estado del animal no cambia solo:** el panel lo ofrece, no lo hace.
- **Una postulación anonimizada queda de solo lectura.**
- **`unstable_cache` no sabe serializar `BigInt` ni reconstruir `Date`:** toda consulta cacheada pasa por `paraCache` y `desdeCache` de `@/domains/finanzas/consultas`.
- **Idioma:** todo en castellano rioplatense — código, nombres, comentarios, commits y pantallas.
- TypeScript estricto. Sin `any` salvo con comentario que lo justifique.

---

## Estructura de archivos

```
prisma/
  schema.prisma                      + FormularioAdopcion, PreguntaFormulario,
                                       Postulacion, RespuestaPostulacion, enums
src/
  domains/postulaciones/
    tipos.ts                         Tipos del dominio y puerto del repositorio
    validacion.ts                    Validación por tipo de respuesta
    preguntas.ts                     Crear, editar, reordenar, archivar preguntas
    formulario.ts                    Armar el formulario de un animal
    envio.ts                         Enviar una postulación (público)
    gestion.ts                       Estados, borrado de datos personales
    consultas.ts                     Lecturas del panel, cacheadas
  infra/repositorios/
    postulaciones.ts                 Implementación Prisma del puerto
  app/
    adopcion/[slug]/postular/page.tsx        Formulario público
    adopcion/[slug]/postular/acciones.ts     Acción de envío
    adopcion/[slug]/postular/gracias/page.tsx
    panel/(protegido)/postulaciones/page.tsx           Bandeja
    panel/(protegido)/postulaciones/[id]/page.tsx      Detalle
    panel/(protegido)/postulaciones/acciones.ts
    panel/(protegido)/formulario/page.tsx              Configurar preguntas
    panel/(protegido)/formulario/acciones.ts
  ui/postulaciones/
    CampoDePregunta.tsx              Renderiza un campo según su tipo
tests/
  unidad/postulaciones-*.test.ts
  dobles/repositorio-postulaciones-memoria.ts
  integracion/postulaciones-*.test.ts
```

---

## Tarea 1: Modelo de datos

**Archivos:**
- Modificar: `prisma/schema.prisma`
- Crear: la migración generada
- Prueba: `tests/integracion/postulaciones-modelo.test.ts`

**Interfaces:**
- Consume: el esquema de las entregas 1 y 2.
- Produce: modelos `FormularioAdopcion`, `PreguntaFormulario`, `Postulacion`, `RespuestaPostulacion`; enums `TipoRespuesta`, `EstadoPostulacion`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/integracion/postulaciones-modelo.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const animales: string[] = [];
const postulaciones: string[] = [];

afterAll(async () => {
  await prisma.respuestaPostulacion.deleteMany({ where: { postulacionId: { in: postulaciones } } });
  await prisma.postulacion.deleteMany({ where: { id: { in: postulaciones } } });
  await prisma.preguntaFormulario.deleteMany({ where: { animalId: { in: animales } } });
  await prisma.animal.deleteMany({ where: { id: { in: animales } } });
  await prisma.$disconnect();
});

async function animalDePrueba() {
  const animal = await prisma.animal.create({
    data: {
      slug: `postulaciones-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

describe("modelo de postulaciones", () => {
  it("guarda una postulación con sus respuestas", async () => {
    const animal = await animalDePrueba();
    const postulacion = await prisma.postulacion.create({
      data: {
        animalId: animal.id,
        nombre: "Marina Gómez",
        email: "marina@ejemplo.org",
        telefono: "341 555 0000",
        respuestas: {
          create: [
            { textoPregunta: "¿Tenés patio cerrado?", tipo: "SI_NO", valor: "sí", orden: 0 },
            { textoPregunta: "¿Por qué querés adoptarlo?", tipo: "TEXTO_LARGO", valor: "Porque sí.", orden: 1 },
          ],
        },
      },
      include: { respuestas: true },
    });
    postulaciones.push(postulacion.id);

    expect(postulacion.estado).toBe("NUEVA");
    expect(postulacion.respuestas).toHaveLength(2);
    expect(postulacion.anonimizadaEn).toBeNull();
  });

  it("una respuesta sobrevive a que la pregunta se archive", async () => {
    const animal = await animalDePrueba();
    const pregunta = await prisma.preguntaFormulario.create({
      data: { animalId: animal.id, texto: "¿Tenés experiencia con perros grandes?", tipo: "SI_NO", orden: 0 },
    });

    const postulacion = await prisma.postulacion.create({
      data: {
        animalId: animal.id,
        nombre: "Marina",
        email: "marina@ejemplo.org",
        telefono: "341 555 0000",
        respuestas: { create: [{ preguntaId: pregunta.id, textoPregunta: pregunta.texto, tipo: "SI_NO", valor: "sí", orden: 0 }] },
      },
      include: { respuestas: true },
    });
    postulaciones.push(postulacion.id);

    await prisma.preguntaFormulario.update({ where: { id: pregunta.id }, data: { archivada: true, texto: "Texto cambiado" } });

    const respuesta = await prisma.respuestaPostulacion.findFirst({ where: { postulacionId: postulacion.id } });
    // El recorte: la respuesta conserva lo que se preguntó de verdad.
    expect(respuesta!.textoPregunta).toBe("¿Tenés experiencia con perros grandes?");
  });

  it("una pregunta pertenece al formulario base o a un animal", async () => {
    const animal = await animalDePrueba();
    const delAnimal = await prisma.preguntaFormulario.create({
      data: { animalId: animal.id, texto: "Propia del animal", tipo: "TEXTO_CORTO", orden: 0 },
    });
    expect(delAnimal.formularioId).toBeNull();
    expect(delAnimal.animalId).toBe(animal.id);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/integracion/postulaciones-modelo.test.ts`
Esperado: FALLA — `prisma.postulacion` no existe.

- [ ] **Paso 3: Agregar los modelos**

En `prisma/schema.prisma`, copiar los bloques de las §3.1 y §3.2 de la especificación. Agregar además las relaciones inversas en `Animal`:

```prisma
model Animal {
  // ... campos existentes
  preguntas     PreguntaFormulario[]
  postulaciones Postulacion[]
}
```

- [ ] **Paso 4: Generar y aplicar la migración**

```bash
npx prisma migrate dev --name entrega_3_postulaciones
```

- [ ] **Paso 5: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/integracion/postulaciones-modelo.test.ts`
Esperado: PASAN las 3.

- [ ] **Paso 6: Confirmar**

```bash
git add prisma tests/integracion/postulaciones-modelo.test.ts
git commit -m "feat: modelo de postulaciones y formulario configurable

Cada respuesta guarda el texto de la pregunta tal como se hizo: editar o
archivar una pregunta no cambia lo que dicen las postulaciones viejas."
```

---

## Tarea 2: Tipos, puerto y doble en memoria

**Archivos:**
- Crear: `src/domains/postulaciones/tipos.ts`
- Crear: `tests/dobles/repositorio-postulaciones-memoria.ts`

**Interfaces:**
- Consume: `PuertoAuditoria` de `@/domains/animales/tipos`.
- Produce: `Pregunta`, `Postulacion`, `Respuesta`, `RepositorioPostulaciones`, `ContextoPostulaciones`, `repositorioPostulacionesEnMemoria()`.

- [ ] **Paso 1: Definir los tipos**

Crear `src/domains/postulaciones/tipos.ts`:

```ts
import type { PuertoAuditoria } from "@/domains/animales/tipos";

export type TipoRespuesta =
  | "TEXTO_CORTO"
  | "TEXTO_LARGO"
  | "SI_NO"
  | "OPCION_MULTIPLE"
  | "SELECCION_MULTIPLE"
  | "NUMERO"
  | "EMAIL"
  | "TELEFONO";

export type EstadoPostulacion =
  | "NUEVA"
  | "EN_REVISION"
  | "CONTACTADA"
  | "ENTREVISTA"
  | "APROBADA"
  | "RECHAZADA"
  | "ADOPCION_CONCRETADA";

export type Rol = "ADMINISTRACION" | "ANIMALES" | "FINANZAS" | "REDACCION";

export interface Pregunta {
  id: string;
  /** Una pregunta pertenece al formulario base o a un animal, nunca a los dos. */
  formularioId: string | null;
  animalId: string | null;
  texto: string;
  ayuda: string | null;
  tipo: TipoRespuesta;
  opciones: string[];
  obligatoria: boolean;
  orden: number;
  archivada: boolean;
}

export interface Respuesta {
  id: string;
  postulacionId: string;
  preguntaId: string | null;
  /** El recorte: qué se preguntó exactamente, en ese momento. */
  textoPregunta: string;
  tipo: TipoRespuesta;
  valor: string;
  orden: number;
}

export interface Postulacion {
  id: string;
  animalId: string;
  estado: EstadoPostulacion;
  nombre: string;
  email: string;
  telefono: string;
  anonimizadaEn: Date | null;
  creadoEn: Date;
}

export interface FiltroPostulaciones {
  animalId?: string;
  estado?: EstadoPostulacion;
}

export interface RepositorioPostulaciones {
  // Preguntas
  crearPregunta(datos: Omit<Pregunta, "id">): Promise<Pregunta>;
  actualizarPregunta(id: string, cambios: Partial<Pregunta>): Promise<Pregunta>;
  preguntaPorId(id: string): Promise<Pregunta | null>;
  preguntasDelFormulario(): Promise<Pregunta[]>;
  preguntasDelAnimal(animalId: string): Promise<Pregunta[]>;

  // Postulaciones
  crearPostulacion(datos: Omit<Postulacion, "id" | "creadoEn">, respuestas: Omit<Respuesta, "id" | "postulacionId">[]): Promise<Postulacion>;
  actualizarPostulacion(id: string, cambios: Partial<Postulacion>): Promise<Postulacion>;
  postulacionPorId(id: string): Promise<Postulacion | null>;
  listarPostulaciones(filtro: FiltroPostulaciones): Promise<Postulacion[]>;
  respuestasDe(postulacionId: string): Promise<Respuesta[]>;
  /** Para el control de envío repetido. Ver §5.3 de la especificación. */
  postulacionRecienteDe(animalId: string, email: string, desde: Date): Promise<Postulacion | null>;
  /** Borra el contenido de todas las respuestas, conservando las filas. */
  vaciarRespuestas(postulacionId: string): Promise<void>;
}

export interface ContextoPostulaciones {
  usuarioEmail: string;
  rol: Rol;
  repositorio: RepositorioPostulaciones;
  auditoria: PuertoAuditoria;
}
```

- [ ] **Paso 2: Crear el doble en memoria**

Crear `tests/dobles/repositorio-postulaciones-memoria.ts`:

```ts
import type {
  FiltroPostulaciones,
  Postulacion,
  Pregunta,
  RepositorioPostulaciones,
  Respuesta,
} from "@/domains/postulaciones/tipos";

export function repositorioPostulacionesEnMemoria() {
  const preguntas: Pregunta[] = [];
  const postulaciones: Postulacion[] = [];
  const respuestas: Respuesta[] = [];
  let secuencia = 0;
  const id = (prefijo: string) => `${prefijo}-${++secuencia}`;

  const repo: RepositorioPostulaciones = {
    async crearPregunta(datos) {
      const pregunta = { ...datos, id: id("pregunta") } as Pregunta;
      preguntas.push(pregunta);
      return pregunta;
    },
    async actualizarPregunta(idPregunta, cambios) {
      const i = preguntas.findIndex((p) => p.id === idPregunta);
      if (i === -1) throw new Error("No existe la pregunta");
      preguntas[i] = { ...preguntas[i], ...cambios };
      return preguntas[i];
    },
    async preguntaPorId(idPregunta) {
      return preguntas.find((p) => p.id === idPregunta) ?? null;
    },
    async preguntasDelFormulario() {
      return preguntas.filter((p) => p.formularioId !== null).sort((a, b) => a.orden - b.orden);
    },
    async preguntasDelAnimal(animalId) {
      return preguntas.filter((p) => p.animalId === animalId).sort((a, b) => a.orden - b.orden);
    },

    async crearPostulacion(datos, nuevasRespuestas) {
      const postulacion = { ...datos, id: id("postulacion"), creadoEn: new Date() } as Postulacion;
      postulaciones.push(postulacion);
      for (const respuesta of nuevasRespuestas) {
        respuestas.push({ ...respuesta, id: id("respuesta"), postulacionId: postulacion.id });
      }
      return postulacion;
    },
    async actualizarPostulacion(idPostulacion, cambios) {
      const i = postulaciones.findIndex((p) => p.id === idPostulacion);
      if (i === -1) throw new Error("No existe la postulación");
      postulaciones[i] = { ...postulaciones[i], ...cambios };
      return postulaciones[i];
    },
    async postulacionPorId(idPostulacion) {
      return postulaciones.find((p) => p.id === idPostulacion) ?? null;
    },
    async listarPostulaciones(filtro: FiltroPostulaciones) {
      return postulaciones.filter(
        (p) => (!filtro.animalId || p.animalId === filtro.animalId) && (!filtro.estado || p.estado === filtro.estado)
      );
    },
    async respuestasDe(postulacionId) {
      return respuestas.filter((r) => r.postulacionId === postulacionId).sort((a, b) => a.orden - b.orden);
    },
    async postulacionRecienteDe(animalId, email, desde) {
      return (
        postulaciones.find((p) => p.animalId === animalId && p.email === email && p.creadoEn >= desde) ?? null
      );
    },
    async vaciarRespuestas(postulacionId) {
      for (const respuesta of respuestas) {
        if (respuesta.postulacionId === postulacionId) respuesta.valor = "";
      }
    },
  };

  return Object.assign(repo, { preguntas, postulaciones, respuestas });
}
```

- [ ] **Paso 3: Verificar que compila**

Ejecutar: `npx tsc --noEmit`
Esperado: sin errores.

- [ ] **Paso 4: Confirmar**

```bash
git add src/domains/postulaciones/tipos.ts tests/dobles/repositorio-postulaciones-memoria.ts
git commit -m "feat: tipos y puerto del dominio postulaciones"
```

---

## Tarea 3: Validación por tipo de respuesta

Esta es la tarea que decide si el sistema acepta basura o no. Todo lo demás depende de que esté bien.

**Archivos:**
- Crear: `src/domains/postulaciones/validacion.ts`
- Prueba: `tests/unidad/postulaciones-validacion.test.ts`

**Interfaces:**
- Consume: `Pregunta`, `TipoRespuesta`.
- Produce: `validarRespuesta(pregunta, valorCrudo): ResultadoValidacion`, `type ResultadoValidacion`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/postulaciones-validacion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validarRespuesta } from "@/domains/postulaciones/validacion";
import type { Pregunta, TipoRespuesta } from "@/domains/postulaciones/tipos";

function pregunta(tipo: TipoRespuesta, extra: Partial<Pregunta> = {}): Pregunta {
  return {
    id: "p1",
    formularioId: "f1",
    animalId: null,
    texto: "Pregunta de prueba",
    ayuda: null,
    tipo,
    opciones: [],
    obligatoria: false,
    orden: 0,
    archivada: false,
    ...extra,
  };
}

describe("obligatoriedad", () => {
  it("una obligatoria vacía se rechaza", () => {
    const resultado = validarRespuesta(pregunta("TEXTO_CORTO", { obligatoria: true }), "   ");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/obligatoria|completá/i);
  });

  it("una opcional vacía se acepta y queda en blanco", () => {
    const resultado = validarRespuesta(pregunta("TEXTO_CORTO"), "");
    expect(resultado).toEqual({ ok: true, valor: "" });
  });
});

describe("texto", () => {
  it("recorta los espacios de los extremos", () => {
    expect(validarRespuesta(pregunta("TEXTO_CORTO"), "  Marina  ")).toEqual({ ok: true, valor: "Marina" });
  });

  it("rechaza un texto corto de más de 200 caracteres", () => {
    const resultado = validarRespuesta(pregunta("TEXTO_CORTO"), "a".repeat(201));
    expect(resultado.ok).toBe(false);
  });

  it("acepta un texto largo de 4000 caracteres", () => {
    expect(validarRespuesta(pregunta("TEXTO_LARGO"), "a".repeat(4000)).ok).toBe(true);
  });

  it("rechaza un texto largo de más de 4000", () => {
    expect(validarRespuesta(pregunta("TEXTO_LARGO"), "a".repeat(4001)).ok).toBe(false);
  });
});

describe("sí o no", () => {
  it("acepta sí y no, con o sin tilde", () => {
    expect(validarRespuesta(pregunta("SI_NO"), "sí")).toEqual({ ok: true, valor: "sí" });
    expect(validarRespuesta(pregunta("SI_NO"), "si")).toEqual({ ok: true, valor: "sí" });
    expect(validarRespuesta(pregunta("SI_NO"), "No")).toEqual({ ok: true, valor: "no" });
  });

  it("rechaza cualquier otra cosa", () => {
    expect(validarRespuesta(pregunta("SI_NO"), "más o menos").ok).toBe(false);
  });
});

describe("opciones", () => {
  const conOpciones = pregunta("OPCION_MULTIPLE", { opciones: ["Casa con patio", "Departamento"] });

  it("acepta una opción de la lista", () => {
    expect(validarRespuesta(conOpciones, "Departamento")).toEqual({ ok: true, valor: "Departamento" });
  });

  it("rechaza una opción inventada: es el caso del envío sin navegador", () => {
    const resultado = validarRespuesta(conOpciones, "Carpa");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/opci/i);
  });

  it("la selección múltiple acepta varias y las guarda separadas por salto de línea", () => {
    const multiple = pregunta("SELECCION_MULTIPLE", { opciones: ["Perros", "Gatos", "Ninguno"] });
    expect(validarRespuesta(multiple, ["Perros", "Gatos"])).toEqual({ ok: true, valor: "Perros\nGatos" });
  });

  it("la selección múltiple rechaza si una sola no está en la lista", () => {
    const multiple = pregunta("SELECCION_MULTIPLE", { opciones: ["Perros", "Gatos"] });
    expect(validarRespuesta(multiple, ["Perros", "Iguanas"]).ok).toBe(false);
  });
});

describe("número, correo y teléfono", () => {
  it("acepta un número", () => {
    expect(validarRespuesta(pregunta("NUMERO"), "3")).toEqual({ ok: true, valor: "3" });
  });

  it("rechaza un número que no lo es", () => {
    expect(validarRespuesta(pregunta("NUMERO"), "tres").ok).toBe(false);
  });

  it("acepta un correo con forma de correo", () => {
    expect(validarRespuesta(pregunta("EMAIL"), "marina@ejemplo.org").ok).toBe(true);
  });

  it("rechaza un correo sin arroba", () => {
    expect(validarRespuesta(pregunta("EMAIL"), "marina.ejemplo.org").ok).toBe(false);
  });

  it("acepta un teléfono con espacios, guiones y prefijo", () => {
    expect(validarRespuesta(pregunta("TELEFONO"), "+54 341 555-0000").ok).toBe(true);
  });

  it("rechaza un teléfono con letras", () => {
    expect(validarRespuesta(pregunta("TELEFONO"), "llamame").ok).toBe(false);
  });

  it("rechaza un teléfono demasiado corto", () => {
    expect(validarRespuesta(pregunta("TELEFONO"), "1234").ok).toBe(false);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/postulaciones-validacion.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/postulaciones/validacion.ts`:

```ts
import type { Pregunta } from "./tipos";

export type ResultadoValidacion = { ok: true; valor: string } | { ok: false; error: string };

const LARGO_MAXIMO: Record<string, number> = { TEXTO_CORTO: 200, TEXTO_LARGO: 4000 };

/**
 * Valida una respuesta contra el tipo de su pregunta.
 *
 * Corre en el servidor. La validación del navegador es una comodidad para
 * quien completa el formulario, no una garantía: el formulario se puede
 * enviar sin navegador, y entonces lo único que protege los datos es esto.
 */
export function validarRespuesta(pregunta: Pregunta, valorCrudo: string | string[]): ResultadoValidacion {
  const esLista = Array.isArray(valorCrudo);
  const vacio = esLista ? valorCrudo.length === 0 : valorCrudo.trim().length === 0;

  if (vacio) {
    return pregunta.obligatoria
      ? { ok: false, error: `Completá "${pregunta.texto}": es obligatoria` }
      : { ok: true, valor: "" };
  }

  switch (pregunta.tipo) {
    case "TEXTO_CORTO":
    case "TEXTO_LARGO": {
      const valor = String(valorCrudo).trim();
      const maximo = LARGO_MAXIMO[pregunta.tipo];
      if (valor.length > maximo) {
        return { ok: false, error: `La respuesta a "${pregunta.texto}" no puede pasar de ${maximo} caracteres` };
      }
      return { ok: true, valor };
    }

    case "SI_NO": {
      const normalizado = String(valorCrudo).trim().toLowerCase();
      if (normalizado === "si" || normalizado === "sí") return { ok: true, valor: "sí" };
      if (normalizado === "no") return { ok: true, valor: "no" };
      return { ok: false, error: `Respondé "${pregunta.texto}" con sí o no` };
    }

    case "OPCION_MULTIPLE": {
      const valor = String(valorCrudo).trim();
      if (!pregunta.opciones.includes(valor)) {
        return { ok: false, error: `"${valor}" no es una opción de "${pregunta.texto}"` };
      }
      return { ok: true, valor };
    }

    case "SELECCION_MULTIPLE": {
      const valores = (esLista ? valorCrudo : [String(valorCrudo)]).map((v) => v.trim());
      const invalida = valores.find((v) => !pregunta.opciones.includes(v));
      if (invalida) {
        return { ok: false, error: `"${invalida}" no es una opción de "${pregunta.texto}"` };
      }
      // Se guardan separados por salto de línea: el tipo dice cómo leerlo.
      return { ok: true, valor: valores.join("\n") };
    }

    case "NUMERO": {
      const valor = String(valorCrudo).trim();
      if (!Number.isFinite(Number(valor))) {
        return { ok: false, error: `Respondé "${pregunta.texto}" con un número` };
      }
      return { ok: true, valor };
    }

    case "EMAIL": {
      const valor = String(valorCrudo).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
        return { ok: false, error: `"${valor}" no parece un correo electrónico` };
      }
      return { ok: true, valor };
    }

    case "TELEFONO": {
      const valor = String(valorCrudo).trim();
      if (!/^[\d\s\-()+]{8,20}$/.test(valor)) {
        return { ok: false, error: `"${valor}" no parece un teléfono` };
      }
      return { ok: true, valor };
    }
  }
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/postulaciones-validacion.test.ts`
Esperado: PASAN las 18.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/postulaciones/validacion.ts tests/unidad/postulaciones-validacion.test.ts
git commit -m "feat: validación de respuestas por tipo de pregunta

Corre en el servidor: el formulario se puede enviar sin navegador, y
entonces lo único que protege los datos es esta función."
```

---

## Tarea 4: Gestión de preguntas

**Archivos:**
- Crear: `src/domains/postulaciones/preguntas.ts`
- Prueba: `tests/unidad/postulaciones-preguntas.test.ts`

**Interfaces:**
- Consume: `ContextoPostulaciones`, `puede` de `@/domains/usuarios/autorizacion`.
- Produce: `crearPregunta(entrada, ctx)`, `editarPregunta(id, cambios, ctx)`, `archivarPregunta(id, ctx)`, `reordenarPreguntas(ids, ctx)`, `exigirPermisoSobrePostulaciones(ctx)`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/postulaciones-preguntas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { crearPregunta, editarPregunta, archivarPregunta, reordenarPreguntas } from "@/domains/postulaciones/preguntas";
import { repositorioPostulacionesEnMemoria } from "../dobles/repositorio-postulaciones-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import type { Rol } from "@/domains/postulaciones/tipos";

function contexto(rol: Rol = "ANIMALES") {
  return {
    usuarioEmail: "marina@huellas.org.ar",
    rol,
    repositorio: repositorioPostulacionesEnMemoria(),
    auditoria: auditoriaEnMemoria(),
  };
}

const base = { texto: "¿Tenés patio cerrado?", tipo: "SI_NO" as const, obligatoria: true };

describe("crearPregunta", () => {
  it("la agrega al formulario base cuando no se indica animal", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta(base, ctx);
    expect(pregunta.formularioId).not.toBeNull();
    expect(pregunta.animalId).toBeNull();
    expect(pregunta.archivada).toBe(false);
  });

  it("la agrega al animal cuando se indica uno", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta({ ...base, animalId: "animal-1" }, ctx);
    expect(pregunta.animalId).toBe("animal-1");
    expect(pregunta.formularioId).toBeNull();
  });

  it("la nueva queda al final del orden", async () => {
    const ctx = contexto();
    await crearPregunta(base, ctx);
    const segunda = await crearPregunta({ ...base, texto: "¿Vivís en casa o departamento?" }, ctx);
    expect(segunda.orden).toBe(1);
  });

  it("una pregunta de opciones exige al menos dos", async () => {
    const ctx = contexto();
    await expect(
      crearPregunta({ texto: "¿Dónde vivís?", tipo: "OPCION_MULTIPLE", opciones: ["Casa"] }, ctx)
    ).rejects.toThrow(/dos opciones/i);
  });

  it("una pregunta que no es de opciones no acepta opciones", async () => {
    const ctx = contexto();
    await expect(
      crearPregunta({ texto: "¿Tenés patio?", tipo: "SI_NO", opciones: ["Sí", "No"] }, ctx)
    ).rejects.toThrow(/no lleva opciones/i);
  });

  it("el rol de finanzas no puede tocar el formulario", async () => {
    await expect(crearPregunta(base, contexto("FINANZAS"))).rejects.toThrow(/permiso/i);
  });

  it("deja rastro en auditoría", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta(base, ctx);
    const auditoria = ctx.auditoria as ReturnType<typeof auditoriaEnMemoria>;
    expect(auditoria.entradas.at(-1)).toMatchObject({ accion: "pregunta.crear", entidadId: pregunta.id });
  });
});

describe("editarPregunta", () => {
  it("cambia el texto", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta(base, ctx);
    const editada = await editarPregunta(pregunta.id, { texto: "¿Tenés patio o balcón cerrado?" }, ctx);
    expect(editada.texto).toBe("¿Tenés patio o balcón cerrado?");
  });

  it("no permite cambiarle el tipo: las respuestas viejas quedarían sin sentido", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta(base, ctx);
    await expect(editarPregunta(pregunta.id, { tipo: "TEXTO_LARGO" } as never, ctx)).rejects.toThrow(/tipo/i);
  });
});

describe("archivarPregunta", () => {
  it("la archiva en vez de borrarla", async () => {
    const ctx = contexto();
    const pregunta = await crearPregunta(base, ctx);
    const archivada = await archivarPregunta(pregunta.id, ctx);
    expect(archivada.archivada).toBe(true);
    expect(await ctx.repositorio.preguntaPorId(pregunta.id)).not.toBeNull();
  });
});

describe("reordenarPreguntas", () => {
  it("reasigna el orden según la lista recibida", async () => {
    const ctx = contexto();
    const a = await crearPregunta({ ...base, texto: "Primera" }, ctx);
    const b = await crearPregunta({ ...base, texto: "Segunda" }, ctx);
    const c = await crearPregunta({ ...base, texto: "Tercera" }, ctx);

    await reordenarPreguntas([c.id, a.id, b.id], ctx);

    expect((await ctx.repositorio.preguntaPorId(c.id))!.orden).toBe(0);
    expect((await ctx.repositorio.preguntaPorId(a.id))!.orden).toBe(1);
    expect((await ctx.repositorio.preguntaPorId(b.id))!.orden).toBe(2);
  });

  it("rechaza una lista que no incluya todas las preguntas", async () => {
    const ctx = contexto();
    const a = await crearPregunta({ ...base, texto: "Primera" }, ctx);
    await crearPregunta({ ...base, texto: "Segunda" }, ctx);
    await expect(reordenarPreguntas([a.id], ctx)).rejects.toThrow(/todas las preguntas/i);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/postulaciones-preguntas.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/postulaciones/preguntas.ts`:

```ts
import { puede } from "@/domains/usuarios/autorizacion";
import type { ContextoPostulaciones, Pregunta, TipoRespuesta } from "./tipos";

/** Identificador del formulario base. Hay uno solo. */
export const FORMULARIO_BASE = "formulario-base";

const TIPOS_CON_OPCIONES: TipoRespuesta[] = ["OPCION_MULTIPLE", "SELECCION_MULTIPLE"];

export function exigirPermisoSobrePostulaciones(ctx: ContextoPostulaciones): void {
  if (!puede(ctx.rol, "postulaciones.escribir")) {
    throw new Error(`El rol ${ctx.rol} no tiene permiso para gestionar postulaciones`);
  }
}

export interface EntradaPregunta {
  texto: string;
  tipo: TipoRespuesta;
  ayuda?: string | null;
  opciones?: string[];
  obligatoria?: boolean;
  /** Si viene, la pregunta es propia de ese animal en vez del formulario base. */
  animalId?: string | null;
}

function validarOpciones(tipo: TipoRespuesta, opciones: string[]): void {
  const llevaOpciones = TIPOS_CON_OPCIONES.includes(tipo);
  if (llevaOpciones && opciones.length < 2) {
    throw new Error("Una pregunta de opciones necesita al menos dos opciones");
  }
  if (!llevaOpciones && opciones.length > 0) {
    throw new Error(`Una pregunta de tipo ${tipo} no lleva opciones`);
  }
}

export async function crearPregunta(entrada: EntradaPregunta, ctx: ContextoPostulaciones): Promise<Pregunta> {
  exigirPermisoSobrePostulaciones(ctx);

  const texto = entrada.texto.trim();
  if (texto.length === 0) throw new Error("La pregunta necesita un texto");

  const opciones = entrada.opciones ?? [];
  validarOpciones(entrada.tipo, opciones);

  const animalId = entrada.animalId ?? null;
  const hermanas = animalId
    ? await ctx.repositorio.preguntasDelAnimal(animalId)
    : await ctx.repositorio.preguntasDelFormulario();

  const pregunta = await ctx.repositorio.crearPregunta({
    formularioId: animalId ? null : FORMULARIO_BASE,
    animalId,
    texto,
    ayuda: entrada.ayuda ?? null,
    tipo: entrada.tipo,
    opciones,
    obligatoria: entrada.obligatoria ?? false,
    // Al final: reordenar es una acción aparte.
    orden: hermanas.length,
    archivada: false,
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "pregunta.crear",
    entidad: "PreguntaFormulario",
    entidadId: pregunta.id,
    valorNuevo: { texto: pregunta.texto, tipo: pregunta.tipo, animalId },
  });
  return pregunta;
}

/**
 * El tipo no se puede cambiar. Una pregunta de sí/no que pasa a texto largo
 * deja veinte respuestas que dicen "sí" contestando algo que ya no es una
 * pregunta de sí o no. Si hace falta otro tipo, se archiva y se crea otra.
 */
const CAMPOS_PROHIBIDOS = ["id", "tipo", "formularioId", "animalId", "orden"] as const;

export async function editarPregunta(
  id: string,
  cambios: Partial<Pregunta>,
  ctx: ContextoPostulaciones
): Promise<Pregunta> {
  exigirPermisoSobrePostulaciones(ctx);

  const anterior = await ctx.repositorio.preguntaPorId(id);
  if (!anterior) throw new Error("No existe la pregunta");

  if (cambios.tipo !== undefined && cambios.tipo !== anterior.tipo) {
    throw new Error(
      "No se puede cambiar el tipo de una pregunta: las respuestas ya dadas quedarían sin sentido. Archivala y creá otra."
    );
  }

  const seguros = { ...cambios };
  for (const campo of CAMPOS_PROHIBIDOS) delete seguros[campo];
  if (seguros.opciones) validarOpciones(anterior.tipo, seguros.opciones);

  const editada = await ctx.repositorio.actualizarPregunta(id, seguros);
  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "pregunta.editar",
    entidad: "PreguntaFormulario",
    entidadId: id,
    valorAnterior: { texto: anterior.texto, obligatoria: anterior.obligatoria },
    valorNuevo: { texto: editada.texto, obligatoria: editada.obligatoria },
  });
  return editada;
}

export async function archivarPregunta(id: string, ctx: ContextoPostulaciones): Promise<Pregunta> {
  exigirPermisoSobrePostulaciones(ctx);
  const anterior = await ctx.repositorio.preguntaPorId(id);
  if (!anterior) throw new Error("No existe la pregunta");

  const archivada = await ctx.repositorio.actualizarPregunta(id, { archivada: true });
  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "pregunta.archivar",
    entidad: "PreguntaFormulario",
    entidadId: id,
    valorAnterior: { archivada: false },
    valorNuevo: { archivada: true },
  });
  return archivada;
}

export async function reordenarPreguntas(idsEnOrden: string[], ctx: ContextoPostulaciones): Promise<void> {
  exigirPermisoSobrePostulaciones(ctx);

  const primera = await ctx.repositorio.preguntaPorId(idsEnOrden[0] ?? "");
  if (!primera) throw new Error("No existe la pregunta");

  const hermanas = primera.animalId
    ? await ctx.repositorio.preguntasDelAnimal(primera.animalId)
    : await ctx.repositorio.preguntasDelFormulario();

  const existentes = new Set(hermanas.map((p) => p.id));
  const recibidos = new Set(idsEnOrden);
  if (existentes.size !== recibidos.size || [...existentes].some((id) => !recibidos.has(id))) {
    throw new Error("El nuevo orden tiene que incluir todas las preguntas, exactamente una vez");
  }

  for (const [orden, id] of idsEnOrden.entries()) {
    await ctx.repositorio.actualizarPregunta(id, { orden });
  }

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "pregunta.reordenar",
    entidad: "PreguntaFormulario",
    entidadId: primera.animalId ?? FORMULARIO_BASE,
    valorNuevo: { orden: idsEnOrden },
  });
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/postulaciones-preguntas.test.ts`
Esperado: PASAN las 13.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/postulaciones/preguntas.ts tests/unidad/postulaciones-preguntas.test.ts
git commit -m "feat: gestión de preguntas del formulario

El tipo de una pregunta no se puede cambiar: las respuestas ya dadas
quedarían contestando algo que la pregunta ya no dice."
```

---

## Tarea 5: Armar el formulario de un animal

**Archivos:**
- Crear: `src/domains/postulaciones/formulario.ts`
- Prueba: `tests/unidad/postulaciones-formulario.test.ts`

**Interfaces:**
- Consume: `RepositorioPostulaciones`.
- Produce: `armarFormulario(animalId, repositorio): Promise<Pregunta[]>`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/postulaciones-formulario.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { armarFormulario } from "@/domains/postulaciones/formulario";
import { crearPregunta, archivarPregunta } from "@/domains/postulaciones/preguntas";
import { repositorioPostulacionesEnMemoria } from "../dobles/repositorio-postulaciones-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

function contexto() {
  return {
    usuarioEmail: "marina@huellas.org.ar",
    rol: "ANIMALES" as const,
    repositorio: repositorioPostulacionesEnMemoria(),
    auditoria: auditoriaEnMemoria(),
  };
}

describe("armarFormulario", () => {
  it("pone primero las del formulario base y después las del animal", async () => {
    const ctx = contexto();
    await crearPregunta({ texto: "Base 1", tipo: "TEXTO_CORTO" }, ctx);
    await crearPregunta({ texto: "Base 2", tipo: "TEXTO_CORTO" }, ctx);
    await crearPregunta({ texto: "Del animal", tipo: "SI_NO", animalId: "animal-1" }, ctx);

    const preguntas = await armarFormulario("animal-1", ctx.repositorio);
    expect(preguntas.map((p) => p.texto)).toEqual(["Base 1", "Base 2", "Del animal"]);
  });

  it("no incluye las archivadas", async () => {
    const ctx = contexto();
    await crearPregunta({ texto: "Vigente", tipo: "TEXTO_CORTO" }, ctx);
    const vieja = await crearPregunta({ texto: "Archivada", tipo: "TEXTO_CORTO" }, ctx);
    await archivarPregunta(vieja.id, ctx);

    const preguntas = await armarFormulario("animal-1", ctx.repositorio);
    expect(preguntas.map((p) => p.texto)).toEqual(["Vigente"]);
  });

  it("no incluye las preguntas de otro animal", async () => {
    const ctx = contexto();
    await crearPregunta({ texto: "De Juanito", tipo: "SI_NO", animalId: "animal-1" }, ctx);
    await crearPregunta({ texto: "De Luna", tipo: "SI_NO", animalId: "animal-2" }, ctx);

    const preguntas = await armarFormulario("animal-1", ctx.repositorio);
    expect(preguntas.map((p) => p.texto)).toEqual(["De Juanito"]);
  });

  it("un animal sin preguntas propias usa solo el formulario base", async () => {
    const ctx = contexto();
    await crearPregunta({ texto: "Base", tipo: "TEXTO_CORTO" }, ctx);
    const preguntas = await armarFormulario("animal-sin-nada", ctx.repositorio);
    expect(preguntas.map((p) => p.texto)).toEqual(["Base"]);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/postulaciones-formulario.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/postulaciones/formulario.ts`:

```ts
import type { Pregunta, RepositorioPostulaciones } from "./tipos";

/**
 * El formulario que ve una persona: las preguntas activas del formulario base,
 * en su orden, seguidas de las propias de ese animal.
 *
 * Las archivadas no aparecen. Las postulaciones viejas que las respondieron
 * conservan igual el texto de lo que se preguntó.
 */
export async function armarFormulario(
  animalId: string,
  repositorio: RepositorioPostulaciones
): Promise<Pregunta[]> {
  const [base, propias] = await Promise.all([
    repositorio.preguntasDelFormulario(),
    repositorio.preguntasDelAnimal(animalId),
  ]);

  const activas = (preguntas: Pregunta[]) =>
    preguntas.filter((p) => !p.archivada).sort((a, b) => a.orden - b.orden);

  return [...activas(base), ...activas(propias)];
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/postulaciones-formulario.test.ts`
Esperado: PASAN las 4.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/postulaciones/formulario.ts tests/unidad/postulaciones-formulario.test.ts
git commit -m "feat: armado del formulario de un animal"
```

---

## Tarea 6: Enviar una postulación

**Archivos:**
- Crear: `src/domains/postulaciones/envio.ts`
- Prueba: `tests/unidad/postulaciones-envio.test.ts`

**Interfaces:**
- Consume: `armarFormulario`, `validarRespuesta`, `RepositorioPostulaciones`, `PuertoAuditoria`.
- Produce: `enviarPostulacion(entrada, repositorio, auditoria): Promise<{ postulacion: Postulacion; repetida: boolean }>`, `MINUTOS_CONTRA_REPETIDO`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/postulaciones-envio.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { enviarPostulacion } from "@/domains/postulaciones/envio";
import { crearPregunta } from "@/domains/postulaciones/preguntas";
import { repositorioPostulacionesEnMemoria } from "../dobles/repositorio-postulaciones-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

async function escenario() {
  const repositorio = repositorioPostulacionesEnMemoria();
  const auditoria = auditoriaEnMemoria();
  const ctx = { usuarioEmail: "marina@huellas.org.ar", rol: "ANIMALES" as const, repositorio, auditoria };

  const patio = await crearPregunta({ texto: "¿Tenés patio cerrado?", tipo: "SI_NO", obligatoria: true }, ctx);
  const porque = await crearPregunta({ texto: "¿Por qué querés adoptarlo?", tipo: "TEXTO_LARGO" }, ctx);

  return { repositorio, auditoria, patio, porque };
}

const contacto = { animalId: "animal-1", nombre: "Marina Gómez", email: "marina@ejemplo.org", telefono: "341 555 0000" };

describe("enviarPostulacion", () => {
  it("guarda la postulación con sus respuestas, en orden", async () => {
    const e = await escenario();
    const { postulacion } = await enviarPostulacion(
      { ...contacto, respuestas: { [e.patio.id]: "sí", [e.porque.id]: "Porque me encantó." } },
      e.repositorio,
      e.auditoria
    );

    expect(postulacion.estado).toBe("NUEVA");
    const respuestas = await e.repositorio.respuestasDe(postulacion.id);
    expect(respuestas.map((r) => r.valor)).toEqual(["sí", "Porque me encantó."]);
  });

  it("cada respuesta guarda el texto de la pregunta tal como se hizo", async () => {
    const e = await escenario();
    const { postulacion } = await enviarPostulacion(
      { ...contacto, respuestas: { [e.patio.id]: "sí" } },
      e.repositorio,
      e.auditoria
    );

    const respuestas = await e.repositorio.respuestasDe(postulacion.id);
    expect(respuestas[0].textoPregunta).toBe("¿Tenés patio cerrado?");
    expect(respuestas[0].tipo).toBe("SI_NO");
  });

  it("rechaza si falta una obligatoria", async () => {
    const e = await escenario();
    await expect(
      enviarPostulacion({ ...contacto, respuestas: { [e.porque.id]: "Solo esta" } }, e.repositorio, e.auditoria)
    ).rejects.toThrow(/obligatoria|completá/i);
  });

  it("rechaza un valor que no corresponde al tipo", async () => {
    const e = await escenario();
    await expect(
      enviarPostulacion({ ...contacto, respuestas: { [e.patio.id]: "más o menos" } }, e.repositorio, e.auditoria)
    ).rejects.toThrow(/sí o no/i);
  });

  it("rechaza un contacto incompleto", async () => {
    const e = await escenario();
    await expect(
      enviarPostulacion({ ...contacto, email: "no-es-un-correo", respuestas: { [e.patio.id]: "sí" } }, e.repositorio, e.auditoria)
    ).rejects.toThrow(/correo/i);
  });

  it("ignora respuestas a preguntas que no están en el formulario", async () => {
    const e = await escenario();
    const { postulacion } = await enviarPostulacion(
      { ...contacto, respuestas: { [e.patio.id]: "sí", "pregunta-inventada": "cualquier cosa" } },
      e.repositorio,
      e.auditoria
    );
    const respuestas = await e.repositorio.respuestasDe(postulacion.id);
    expect(respuestas).toHaveLength(1);
  });

  it("deja rastro en auditoría sin copiar los datos personales", async () => {
    const e = await escenario();
    const { postulacion } = await enviarPostulacion(
      { ...contacto, respuestas: { [e.patio.id]: "sí" } },
      e.repositorio,
      e.auditoria
    );
    const entrada = (e.auditoria as ReturnType<typeof auditoriaEnMemoria>).entradas.at(-1)!;
    expect(entrada).toMatchObject({ accion: "postulacion.enviar", entidadId: postulacion.id });
    // La bitácora no es lugar para guardar una segunda copia del contacto.
    expect(JSON.stringify(entrada)).not.toContain("marina@ejemplo.org");
  });
});

describe("control de envío repetido", () => {
  it("un segundo envío igual devuelve la misma postulación", async () => {
    const e = await escenario();
    const datos = { ...contacto, respuestas: { [e.patio.id]: "sí" } };

    const primero = await enviarPostulacion(datos, e.repositorio, e.auditoria);
    const segundo = await enviarPostulacion(datos, e.repositorio, e.auditoria);

    expect(segundo.postulacion.id).toBe(primero.postulacion.id);
    expect(segundo.repetida).toBe(true);
    expect(e.repositorio.postulaciones).toHaveLength(1);
  });

  it("el mismo correo para otro animal sí crea una postulación nueva", async () => {
    const e = await escenario();
    await enviarPostulacion({ ...contacto, respuestas: { [e.patio.id]: "sí" } }, e.repositorio, e.auditoria);
    const otra = await enviarPostulacion(
      { ...contacto, animalId: "animal-2", respuestas: { [e.patio.id]: "sí" } },
      e.repositorio,
      e.auditoria
    );
    expect(otra.repetida).toBe(false);
    expect(e.repositorio.postulaciones).toHaveLength(2);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/postulaciones-envio.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/postulaciones/envio.ts`:

```ts
import type { PuertoAuditoria } from "@/domains/animales/tipos";
import { armarFormulario } from "./formulario";
import { validarRespuesta } from "./validacion";
import type { Postulacion, RepositorioPostulaciones, Respuesta } from "./tipos";

/** Ventana del control contra el doble clic. Ver §5.3 de la especificación. */
export const MINUTOS_CONTRA_REPETIDO = 5;

export interface EntradaPostulacion {
  animalId: string;
  nombre: string;
  email: string;
  telefono: string;
  /** Respuestas por identificador de pregunta. */
  respuestas: Record<string, string | string[]>;
}

function validarContacto(entrada: EntradaPostulacion): void {
  if (entrada.nombre.trim().length === 0) throw new Error("Escribí tu nombre y apellido");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entrada.email.trim())) {
    throw new Error("Revisá el correo: no parece una dirección válida");
  }
  if (!/^[\d\s\-()+]{8,20}$/.test(entrada.telefono.trim())) {
    throw new Error("Revisá el teléfono: escribilo con código de área");
  }
}

/**
 * Envío público: no exige sesión ni permisos, igual que la declaración de
 * transferencias de la entrega 2. Lo que protege los datos es la validación,
 * no la autenticación.
 */
export async function enviarPostulacion(
  entrada: EntradaPostulacion,
  repositorio: RepositorioPostulaciones,
  auditoria: PuertoAuditoria
): Promise<{ postulacion: Postulacion; repetida: boolean }> {
  validarContacto(entrada);

  const email = entrada.email.trim().toLowerCase();

  // Contra el doble clic: si ya mandó una para este animal hace un rato, se
  // devuelve esa. Quien la envía ve la misma confirmación, no un error: desde
  // su lado el envío funcionó, porque su postulación está registrada.
  const desde = new Date(Date.now() - MINUTOS_CONTRA_REPETIDO * 60 * 1000);
  const reciente = await repositorio.postulacionRecienteDe(entrada.animalId, email, desde);
  if (reciente) return { postulacion: reciente, repetida: true };

  const preguntas = await armarFormulario(entrada.animalId, repositorio);

  const respuestas: Omit<Respuesta, "id" | "postulacionId">[] = [];
  for (const [orden, pregunta] of preguntas.entries()) {
    const valorCrudo = entrada.respuestas[pregunta.id] ?? "";
    const resultado = validarRespuesta(pregunta, valorCrudo);
    if (!resultado.ok) throw new Error(resultado.error);

    respuestas.push({
      preguntaId: pregunta.id,
      // El recorte: si mañana editan o archivan la pregunta, esto sigue
      // diciendo qué se preguntó de verdad.
      textoPregunta: pregunta.texto,
      tipo: pregunta.tipo,
      valor: resultado.valor,
      orden,
    });
  }

  const postulacion = await repositorio.crearPostulacion(
    {
      animalId: entrada.animalId,
      estado: "NUEVA",
      nombre: entrada.nombre.trim(),
      email,
      telefono: entrada.telefono.trim(),
      anonimizadaEn: null,
    },
    respuestas
  );

  await auditoria.registrar({
    usuarioEmail: "público",
    accion: "postulacion.enviar",
    entidad: "Postulacion",
    entidadId: postulacion.id,
    // Sin datos de contacto: la bitácora no es lugar para una segunda copia,
    // y el borrado a pedido no la alcanzaría.
    valorNuevo: { animalId: entrada.animalId, cantidadRespuestas: respuestas.length },
  });

  return { postulacion, repetida: false };
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/postulaciones-envio.test.ts`
Esperado: PASAN las 9.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/postulaciones/envio.ts tests/unidad/postulaciones-envio.test.ts
git commit -m "feat: envío público de postulaciones

La bitácora no guarda los datos de contacto: sería una segunda copia que
el borrado a pedido no alcanzaría."
```

---

## Tarea 7: Estados y borrado de datos personales

**Archivos:**
- Crear: `src/domains/postulaciones/gestion.ts`
- Prueba: `tests/unidad/postulaciones-gestion.test.ts`

**Interfaces:**
- Consume: `ContextoPostulaciones`, `exigirPermisoSobrePostulaciones`.
- Produce: `cambiarEstado(id, estado, comentario, ctx)`, `borrarDatosPersonales(id, ctx)`, `cerrarOtrasPostulaciones(animalId, exceptoId, ctx)`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/unidad/postulaciones-gestion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cambiarEstado, borrarDatosPersonales, cerrarOtrasPostulaciones } from "@/domains/postulaciones/gestion";
import { enviarPostulacion } from "@/domains/postulaciones/envio";
import { crearPregunta } from "@/domains/postulaciones/preguntas";
import { repositorioPostulacionesEnMemoria } from "../dobles/repositorio-postulaciones-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";
import type { Rol } from "@/domains/postulaciones/tipos";

async function escenario(rol: Rol = "ANIMALES") {
  const repositorio = repositorioPostulacionesEnMemoria();
  const auditoria = auditoriaEnMemoria();
  const ctx = { usuarioEmail: "marina@huellas.org.ar", rol, repositorio, auditoria };

  const patio = await crearPregunta(
    { texto: "¿Tenés patio cerrado?", tipo: "SI_NO" },
    { ...ctx, rol: "ANIMALES" as const }
  );

  const { postulacion } = await enviarPostulacion(
    { animalId: "animal-1", nombre: "Marina Gómez", email: "marina@ejemplo.org", telefono: "341 555 0000", respuestas: { [patio.id]: "sí" } },
    repositorio,
    auditoria
  );

  return { ctx, repositorio, auditoria, postulacion };
}

describe("cambiarEstado", () => {
  it("cambia el estado y guarda el comentario en la auditoría", async () => {
    const e = await escenario();
    const actualizada = await cambiarEstado(e.postulacion.id, "CONTACTADA", "La llamé, quedamos en hablar el jueves", e.ctx);

    expect(actualizada.estado).toBe("CONTACTADA");
    const entrada = (e.auditoria as ReturnType<typeof auditoriaEnMemoria>).entradas.at(-1)!;
    expect(entrada.accion).toBe("postulacion.cambiarEstado");
    expect(JSON.stringify(entrada.valorNuevo)).toContain("jueves");
  });

  it("el comentario es opcional", async () => {
    const e = await escenario();
    const actualizada = await cambiarEstado(e.postulacion.id, "EN_REVISION", null, e.ctx);
    expect(actualizada.estado).toBe("EN_REVISION");
  });

  it("el rol de finanzas no puede cambiar estados", async () => {
    const e = await escenario("FINANZAS");
    await expect(cambiarEstado(e.postulacion.id, "EN_REVISION", null, e.ctx)).rejects.toThrow(/permiso/i);
  });

  it("aprobar una postulación NO cambia el estado del animal", async () => {
    const e = await escenario();
    await cambiarEstado(e.postulacion.id, "APROBADA", null, e.ctx);
    const acciones = (e.auditoria as ReturnType<typeof auditoriaEnMemoria>).entradas.map((x) => x.accion);
    // Nada que toque al animal: el panel lo ofrece, el dominio no lo hace.
    expect(acciones.some((a) => a.startsWith("animal."))).toBe(false);
  });
});

describe("borrarDatosPersonales", () => {
  it("limpia contacto y respuestas, y conserva el caparazón", async () => {
    const e = await escenario();
    const anonimizada = await borrarDatosPersonales(e.postulacion.id, e.ctx);

    expect(anonimizada.nombre).toBe("");
    expect(anonimizada.email).toBe("");
    expect(anonimizada.telefono).toBe("");
    expect(anonimizada.anonimizadaEn).toBeInstanceOf(Date);
    // El caparazón queda: a qué animal, cuándo, en qué estado terminó.
    expect(anonimizada.animalId).toBe("animal-1");
    expect(anonimizada.estado).toBe("NUEVA");

    const respuestas = await e.repositorio.respuestasDe(e.postulacion.id);
    expect(respuestas.every((r) => r.valor === "")).toBe(true);
    // El texto de la pregunta no es dato personal: se conserva.
    expect(respuestas[0].textoPregunta).toBe("¿Tenés patio cerrado?");
  });

  it("queda auditado con quién lo hizo", async () => {
    const e = await escenario();
    await borrarDatosPersonales(e.postulacion.id, e.ctx);
    const entrada = (e.auditoria as ReturnType<typeof auditoriaEnMemoria>).entradas.at(-1)!;
    expect(entrada).toMatchObject({ accion: "postulacion.borrarDatosPersonales", usuarioEmail: "marina@huellas.org.ar" });
  });

  it("una postulación anonimizada queda de solo lectura", async () => {
    const e = await escenario();
    await borrarDatosPersonales(e.postulacion.id, e.ctx);
    await expect(cambiarEstado(e.postulacion.id, "APROBADA", null, e.ctx)).rejects.toThrow(/anonimizada|solo lectura/i);
  });

  it("no se puede borrar dos veces", async () => {
    const e = await escenario();
    await borrarDatosPersonales(e.postulacion.id, e.ctx);
    await expect(borrarDatosPersonales(e.postulacion.id, e.ctx)).rejects.toThrow(/ya .*borrado|anonimizada/i);
  });
});

describe("cerrarOtrasPostulaciones", () => {
  it("rechaza las demás del mismo animal y deja la elegida", async () => {
    const e = await escenario();
    const otra = await enviarPostulacion(
      { animalId: "animal-1", nombre: "Otra persona", email: "otra@ejemplo.org", telefono: "341 555 1111", respuestas: {} },
      e.repositorio,
      e.auditoria
    );

    const cerradas = await cerrarOtrasPostulaciones("animal-1", e.postulacion.id, e.ctx);

    expect(cerradas).toBe(1);
    expect((await e.repositorio.postulacionPorId(otra.postulacion.id))!.estado).toBe("RECHAZADA");
    expect((await e.repositorio.postulacionPorId(e.postulacion.id))!.estado).toBe("NUEVA");
  });

  it("no toca las de otros animales", async () => {
    const e = await escenario();
    const deOtroAnimal = await enviarPostulacion(
      { animalId: "animal-2", nombre: "Tercera", email: "tercera@ejemplo.org", telefono: "341 555 2222", respuestas: {} },
      e.repositorio,
      e.auditoria
    );

    await cerrarOtrasPostulaciones("animal-1", e.postulacion.id, e.ctx);
    expect((await e.repositorio.postulacionPorId(deOtroAnimal.postulacion.id))!.estado).toBe("NUEVA");
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/postulaciones-gestion.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/postulaciones/gestion.ts`:

```ts
import { exigirPermisoSobrePostulaciones } from "./preguntas";
import type { ContextoPostulaciones, EstadoPostulacion, Postulacion } from "./tipos";

async function exigirPostulacionEditable(id: string, ctx: ContextoPostulaciones): Promise<Postulacion> {
  const postulacion = await ctx.repositorio.postulacionPorId(id);
  if (!postulacion) throw new Error("No existe la postulación");
  if (postulacion.anonimizadaEn) {
    // Sin contacto no hay nada que gestionar. Dejarla editable invitaría a
    // moverla de estado como si todavía hubiera una persona del otro lado.
    throw new Error("La postulación está anonimizada: queda de solo lectura");
  }
  return postulacion;
}

/**
 * Cambia el estado y guarda el comentario en la bitácora, que es el historial
 * de la postulación. No hay tabla de notas: el historial es la secuencia de
 * acciones administrativas, y eso ya vive en la auditoría.
 *
 * No toca al animal. Que una postulación se apruebe no significa que la
 * adopción se haya concretado, y un animal que figura como adoptado sin
 * estarlo es un error que se ve en público.
 */
export async function cambiarEstado(
  id: string,
  estado: EstadoPostulacion,
  comentario: string | null,
  ctx: ContextoPostulaciones
): Promise<Postulacion> {
  exigirPermisoSobrePostulaciones(ctx);
  const anterior = await exigirPostulacionEditable(id, ctx);

  const actualizada = await ctx.repositorio.actualizarPostulacion(id, { estado });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "postulacion.cambiarEstado",
    entidad: "Postulacion",
    entidadId: id,
    valorAnterior: { estado: anterior.estado },
    valorNuevo: comentario ? { estado, comentario } : { estado },
  });

  return actualizada;
}

/**
 * Borra los datos de contacto y el contenido de las respuestas, a pedido de la
 * persona. Conserva el caparazón —a qué animal, cuándo, en qué estado
 * terminó— como estadística anónima, y el texto de las preguntas, que no es
 * dato personal.
 */
export async function borrarDatosPersonales(id: string, ctx: ContextoPostulaciones): Promise<Postulacion> {
  exigirPermisoSobrePostulaciones(ctx);

  const postulacion = await ctx.repositorio.postulacionPorId(id);
  if (!postulacion) throw new Error("No existe la postulación");
  if (postulacion.anonimizadaEn) throw new Error("Los datos personales de esta postulación ya se habían borrado");

  await ctx.repositorio.vaciarRespuestas(id);
  const anonimizada = await ctx.repositorio.actualizarPostulacion(id, {
    nombre: "",
    email: "",
    telefono: "",
    anonimizadaEn: new Date(),
  });

  await ctx.auditoria.registrar({
    usuarioEmail: ctx.usuarioEmail,
    accion: "postulacion.borrarDatosPersonales",
    entidad: "Postulacion",
    entidadId: id,
    valorNuevo: { animalId: postulacion.animalId, estado: postulacion.estado },
  });

  return anonimizada;
}

/**
 * Rechaza las demás postulaciones de un animal. Se ofrece al concretar una
 * adopción: si no, quedan en estado "nueva" para siempre y la bandeja deja de
 * servir para saber qué falta atender.
 *
 * Devuelve cuántas cerró.
 */
export async function cerrarOtrasPostulaciones(
  animalId: string,
  exceptoId: string,
  ctx: ContextoPostulaciones
): Promise<number> {
  exigirPermisoSobrePostulaciones(ctx);

  const todas = await ctx.repositorio.listarPostulaciones({ animalId });
  const abiertas = todas.filter(
    (p) => p.id !== exceptoId && p.anonimizadaEn === null && p.estado !== "RECHAZADA" && p.estado !== "ADOPCION_CONCRETADA"
  );

  for (const postulacion of abiertas) {
    await ctx.repositorio.actualizarPostulacion(postulacion.id, { estado: "RECHAZADA" });
    await ctx.auditoria.registrar({
      usuarioEmail: ctx.usuarioEmail,
      accion: "postulacion.cambiarEstado",
      entidad: "Postulacion",
      entidadId: postulacion.id,
      valorAnterior: { estado: postulacion.estado },
      valorNuevo: { estado: "RECHAZADA", comentario: "Cerrada al concretarse la adopción con otra postulación" },
    });
  }

  return abiertas.length;
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/postulaciones-gestion.test.ts`
Esperado: PASAN las 10.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/postulaciones/gestion.ts tests/unidad/postulaciones-gestion.test.ts
git commit -m "feat: estados, cierre en bloque y borrado de datos personales

Aprobar una postulación no toca al animal: un animal que figura como
adoptado sin estarlo es un error que se ve en público."
```

---

## Tarea 8: Repositorio Prisma

**Archivos:**
- Crear: `src/infra/repositorios/postulaciones.ts`
- Prueba: `tests/integracion/postulaciones-repositorio.test.ts`

**Interfaces:**
- Consume: el puerto `RepositorioPostulaciones`, `prisma`.
- Produce: `repositorioPostulacionesPrisma(cliente?)`.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/integracion/postulaciones-repositorio.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { repositorioPostulacionesPrisma } from "@/infra/repositorios/postulaciones";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { enviarPostulacion } from "@/domains/postulaciones/envio";
import { crearPregunta } from "@/domains/postulaciones/preguntas";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });
const animales: string[] = [];
const preguntas: string[] = [];

afterAll(async () => {
  const ids = await prisma.postulacion.findMany({ where: { animalId: { in: animales } }, select: { id: true } });
  await prisma.respuestaPostulacion.deleteMany({ where: { postulacionId: { in: ids.map((p) => p.id) } } });
  await prisma.postulacion.deleteMany({ where: { animalId: { in: animales } } });
  await prisma.preguntaFormulario.deleteMany({ where: { id: { in: preguntas } } });
  await prisma.animal.deleteMany({ where: { id: { in: animales } } });
  await prisma.$disconnect();
});

async function animalDePrueba() {
  const animal = await prisma.animal.create({
    data: {
      slug: `repo-postulaciones-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

describe("repositorio Prisma de postulaciones", () => {
  it("guarda la postulación y sus respuestas en una sola transacción", async () => {
    const animal = await animalDePrueba();

    const pregunta = await prisma.$transaction(async (tx) =>
      crearPregunta(
        { texto: "¿Tenés patio cerrado?", tipo: "SI_NO", obligatoria: true },
        {
          usuarioEmail: "prueba@huellas.org.ar",
          rol: "ANIMALES",
          repositorio: repositorioPostulacionesPrisma(tx),
          auditoria: auditoriaPrisma(tx),
        }
      )
    );
    preguntas.push(pregunta.id);

    const { postulacion } = await prisma.$transaction(async (tx) =>
      enviarPostulacion(
        { animalId: animal.id, nombre: "Marina", email: "marina@ejemplo.org", telefono: "341 555 0000", respuestas: { [pregunta.id]: "sí" } },
        repositorioPostulacionesPrisma(tx),
        auditoriaPrisma(tx)
      )
    );

    const guardadas = await prisma.respuestaPostulacion.findMany({ where: { postulacionId: postulacion.id } });
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0].textoPregunta).toBe("¿Tenés patio cerrado?");
  });

  it("si falla la auditoría no queda ni la postulación ni sus respuestas", async () => {
    const animal = await animalDePrueba();
    const antes = await prisma.postulacion.count({ where: { animalId: animal.id } });

    await expect(
      prisma.$transaction(async (tx) =>
        enviarPostulacion(
          { animalId: animal.id, nombre: "No debe quedar", email: "no@ejemplo.org", telefono: "341 555 0000", respuestas: {} },
          repositorioPostulacionesPrisma(tx),
          { async registrar() { throw new Error("auditoría caída"); } }
        )
      )
    ).rejects.toThrow(/auditoría caída/);

    expect(await prisma.postulacion.count({ where: { animalId: animal.id } })).toBe(antes);
  });

  it("encuentra una postulación reciente del mismo correo y animal", async () => {
    const animal = await animalDePrueba();
    const { postulacion } = await prisma.$transaction(async (tx) =>
      enviarPostulacion(
        { animalId: animal.id, nombre: "Marina", email: "Marina@Ejemplo.org", telefono: "341 555 0000", respuestas: {} },
        repositorioPostulacionesPrisma(tx),
        auditoriaPrisma(tx)
      )
    );

    const hace5Minutos = new Date(Date.now() - 5 * 60 * 1000);
    // El correo se guarda en minúsculas: la búsqueda tiene que encontrarlo igual.
    const encontrada = await repositorioPostulacionesPrisma(prisma).postulacionRecienteDe(
      animal.id,
      "marina@ejemplo.org",
      hace5Minutos
    );
    expect(encontrada?.id).toBe(postulacion.id);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/integracion/postulaciones-repositorio.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/infra/repositorios/postulaciones.ts`, siguiendo el patrón de `repositorios/finanzas.ts`:

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as clientePorDefecto } from "@/infra/prisma";
import { FORMULARIO_BASE } from "@/domains/postulaciones/preguntas";
import type {
  FiltroPostulaciones,
  Postulacion,
  Pregunta,
  RepositorioPostulaciones,
  Respuesta,
} from "@/domains/postulaciones/tipos";

type ClienteBase = PrismaClient | Prisma.TransactionClient;

export function repositorioPostulacionesPrisma(cliente: ClienteBase = clientePorDefecto): RepositorioPostulaciones {
  return {
    async crearPregunta(datos) {
      // El formulario base es una fila única: se crea sola la primera vez.
      if (datos.formularioId) {
        await cliente.formularioAdopcion.upsert({
          where: { id: datos.formularioId },
          update: {},
          create: { id: datos.formularioId },
        });
      }
      return (await cliente.preguntaFormulario.create({ data: datos as never })) as unknown as Pregunta;
    },
    async actualizarPregunta(id, cambios) {
      return (await cliente.preguntaFormulario.update({ where: { id }, data: cambios as never })) as unknown as Pregunta;
    },
    async preguntaPorId(id) {
      return (await cliente.preguntaFormulario.findUnique({ where: { id } })) as unknown as Pregunta | null;
    },
    async preguntasDelFormulario() {
      return (await cliente.preguntaFormulario.findMany({
        where: { formularioId: FORMULARIO_BASE },
        orderBy: { orden: "asc" },
      })) as unknown as Pregunta[];
    },
    async preguntasDelAnimal(animalId) {
      return (await cliente.preguntaFormulario.findMany({
        where: { animalId },
        orderBy: { orden: "asc" },
      })) as unknown as Pregunta[];
    },

    async crearPostulacion(datos, respuestas) {
      return (await cliente.postulacion.create({
        data: { ...(datos as never), respuestas: { create: respuestas as never } },
      })) as unknown as Postulacion;
    },
    async actualizarPostulacion(id, cambios) {
      return (await cliente.postulacion.update({ where: { id }, data: cambios as never })) as unknown as Postulacion;
    },
    async postulacionPorId(id) {
      return (await cliente.postulacion.findUnique({ where: { id } })) as unknown as Postulacion | null;
    },
    async listarPostulaciones(filtro: FiltroPostulaciones) {
      return (await cliente.postulacion.findMany({
        where: { animalId: filtro.animalId, estado: filtro.estado },
        orderBy: { creadoEn: "desc" },
      })) as unknown as Postulacion[];
    },
    async respuestasDe(postulacionId) {
      return (await cliente.respuestaPostulacion.findMany({
        where: { postulacionId },
        orderBy: { orden: "asc" },
      })) as unknown as Respuesta[];
    },
    async postulacionRecienteDe(animalId, email, desde) {
      return (await cliente.postulacion.findFirst({
        // El dominio guarda el correo en minúsculas, así que la comparación
        // directa alcanza y usa el índice.
        where: { animalId, email: email.toLowerCase(), creadoEn: { gte: desde } },
        orderBy: { creadoEn: "desc" },
      })) as unknown as Postulacion | null;
    },
    async vaciarRespuestas(postulacionId) {
      await cliente.respuestaPostulacion.updateMany({ where: { postulacionId }, data: { valor: "" } });
    },
  };
}
```

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/integracion/postulaciones-repositorio.test.ts`
Esperado: PASAN las 3.

- [ ] **Paso 5: Confirmar**

```bash
git add src/infra/repositorios/postulaciones.ts tests/integracion/postulaciones-repositorio.test.ts
git commit -m "feat: repositorio Prisma de postulaciones"
```

---

## Tarea 9: El formulario público

**Archivos:**
- Crear: `src/app/adopcion/[slug]/postular/page.tsx`, `postular/acciones.ts`, `postular/gracias/page.tsx`, `src/ui/postulaciones/CampoDePregunta.tsx` y su módulo CSS
- Prueba: manual (paso 5)

**Interfaces:**
- Consume: `armarFormulario`, `enviarPostulacion`, `animalPorSlug`.
- Produce: la ruta pública `/adopcion/<animal>/postular` y la acción `accionEnviarPostulacion`.

- [ ] **Paso 1: El componente que renderiza una pregunta**

Crear `src/ui/postulaciones/CampoDePregunta.tsx`:

```tsx
import { Campo } from "@/ui/componentes/Campo";
import type { Pregunta } from "@/domains/postulaciones/tipos";
import estilos from "./CampoDePregunta.module.css";

/**
 * Un campo por tipo de pregunta. El nombre del campo es el identificador de
 * la pregunta: así la acción de envío arma el mapa de respuestas sin conocer
 * el formulario de antemano.
 */
export function CampoDePregunta({ pregunta }: { pregunta: Pregunta }) {
  const nombre = pregunta.id;
  const etiqueta = pregunta.obligatoria ? `${pregunta.texto} *` : pregunta.texto;

  if (pregunta.tipo === "TEXTO_LARGO") {
    return (
      <Campo etiqueta={etiqueta} nombre={nombre} ayuda={pregunta.ayuda ?? undefined}>
        <textarea id={nombre} name={nombre} required={pregunta.obligatoria} maxLength={4000} rows={5} />
      </Campo>
    );
  }

  if (pregunta.tipo === "SI_NO") {
    return (
      <fieldset className={estilos.grupo}>
        <legend>{etiqueta}</legend>
        {["sí", "no"].map((opcion) => (
          <label key={opcion} className={estilos.opcion}>
            <input type="radio" name={nombre} value={opcion} required={pregunta.obligatoria} />
            {opcion}
          </label>
        ))}
      </fieldset>
    );
  }

  if (pregunta.tipo === "OPCION_MULTIPLE" || pregunta.tipo === "SELECCION_MULTIPLE") {
    const multiple = pregunta.tipo === "SELECCION_MULTIPLE";
    return (
      <fieldset className={estilos.grupo}>
        <legend>{etiqueta}</legend>
        {pregunta.ayuda ? <p className={estilos.ayuda}>{pregunta.ayuda}</p> : null}
        {pregunta.opciones.map((opcion) => (
          <label key={opcion} className={estilos.opcion}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={nombre}
              value={opcion}
              required={pregunta.obligatoria && !multiple}
            />
            {opcion}
          </label>
        ))}
      </fieldset>
    );
  }

  const tipoDeCampo = { TEXTO_CORTO: "text", NUMERO: "number", EMAIL: "email", TELEFONO: "tel" }[
    pregunta.tipo as "TEXTO_CORTO" | "NUMERO" | "EMAIL" | "TELEFONO"
  ];

  return (
    <Campo etiqueta={etiqueta} nombre={nombre} ayuda={pregunta.ayuda ?? undefined}>
      <input id={nombre} name={nombre} type={tipoDeCampo} required={pregunta.obligatoria} maxLength={200} />
    </Campo>
  );
}
```

Crear `CampoDePregunta.module.css` con `.grupo` como `fieldset` sin borde, `.opcion` con área táctil de 44px según la §9 del sistema de diseño, y `.ayuda` en `var(--ink-2)`.

- [ ] **Paso 2: La página del formulario**

Crear `src/app/adopcion/[slug]/postular/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { animalPorSlug } from "@/domains/animales/consultas";
import { preguntasDelFormularioDe } from "@/domains/postulaciones/consultas";
import { Boton } from "@/ui/componentes/Boton";
import { Campo } from "@/ui/componentes/Campo";
import { CampoDePregunta } from "@/ui/postulaciones/CampoDePregunta";
import { accionEnviarPostulacion } from "./acciones";

export const metadata = { robots: { index: false, follow: true } };

export default async function Postular({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const animal = await animalPorSlug(slug);
  if (!animal) notFound();

  const preguntas = await preguntasDelFormularioDe(animal.id);

  return (
    <main>
      <h1>Postulación para {animal.nombre}</h1>
      <p>Cinco minutos. No hace falta crear una cuenta.</p>

      <p>
        Tus datos personales son privados: los ven únicamente las personas del refugio con permiso de
        adopciones. Nunca aparecen en la parte pública del sitio.
      </p>

      <form action={accionEnviarPostulacion}>
        <input type="hidden" name="slug" value={slug} />

        <Campo etiqueta="Nombre y apellido *" nombre="nombre">
          <input id="nombre" name="nombre" autoComplete="name" required />
        </Campo>
        <Campo etiqueta="Correo electrónico *" nombre="email">
          <input id="email" name="email" type="email" autoComplete="email" required />
        </Campo>
        <Campo etiqueta="Teléfono o WhatsApp *" nombre="telefono" ayuda="Con código de área.">
          <input id="telefono" name="telefono" type="tel" autoComplete="tel" required />
        </Campo>

        {preguntas.map((pregunta) => (
          <CampoDePregunta key={pregunta.id} pregunta={pregunta} />
        ))}

        <Boton type="submit" variante="primario">
          Enviar postulación
        </Boton>
      </form>
    </main>
  );
}
```

- [ ] **Paso 3: La acción de envío**

Crear `src/app/adopcion/[slug]/postular/acciones.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/infra/prisma";
import { repositorioPostulacionesPrisma } from "@/infra/repositorios/postulaciones";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { enviarPostulacion } from "@/domains/postulaciones/envio";
import { animalPorSlug } from "@/domains/animales/consultas";

/** Los campos del contacto no son preguntas: el resto del formulario sí. */
const CAMPOS_DE_CONTACTO = new Set(["slug", "nombre", "email", "telefono"]);

export async function accionEnviarPostulacion(formulario: FormData) {
  const slug = String(formulario.get("slug") ?? "");
  const animal = await animalPorSlug(slug);
  if (!animal) throw new Error("No existe el animal");

  // Cada campo que no es de contacto es una respuesta, y su nombre es el
  // identificador de la pregunta. getAll cubre la selección múltiple.
  const respuestas: Record<string, string | string[]> = {};
  for (const clave of new Set(formulario.keys())) {
    if (CAMPOS_DE_CONTACTO.has(clave)) continue;
    const valores = formulario.getAll(clave).map(String);
    respuestas[clave] = valores.length > 1 ? valores : (valores[0] ?? "");
  }

  const { postulacion } = await prisma.$transaction(async (tx) =>
    enviarPostulacion(
      {
        animalId: animal.id,
        nombre: String(formulario.get("nombre") ?? ""),
        email: String(formulario.get("email") ?? ""),
        telefono: String(formulario.get("telefono") ?? ""),
        respuestas,
      },
      repositorioPostulacionesPrisma(tx),
      auditoriaPrisma(tx)
    )
  );

  // Un envío repetido llega acá igual y ve la misma confirmación: desde su
  // lado funcionó, porque su postulación está registrada.
  redirect(`/adopcion/${slug}/postular/gracias?ref=${postulacion.id.slice(-5).toUpperCase()}`);
}
```

- [ ] **Paso 4: La confirmación**

Crear `src/app/adopcion/[slug]/postular/gracias/page.tsx`:

```tsx
import Link from "next/link";
import { animalPorSlug } from "@/domains/animales/consultas";

export const metadata = { robots: { index: false, follow: true } };

export default async function Gracias({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const [{ slug }, { ref }] = await Promise.all([params, searchParams]);
  const animal = await animalPorSlug(slug);

  return (
    <main>
      <h1>Recibimos tu postulación</h1>
      {ref ? <p>Tu número de referencia es POST-{ref}. Guardalo por si nos llamás.</p> : null}

      {/* Sin plazo: la asociación son voluntarios y el plazo no lo controla
          el sistema. Prometer "en 48 horas" es prometer por otro. */}
      <p>
        Alguien del refugio va a leerla y se comunica con vos por teléfono o por correo.
        {animal ? ` Mientras tanto, la ficha de ${animal.nombre} sigue disponible.` : ""}
      </p>

      <Link href={`/adopcion/${slug}`}>Volver a la ficha</Link>
      <Link href="/adopcion">Ver otros animales en adopción</Link>
    </main>
  );
}
```

- [ ] **Paso 5: Verificación manual**

Ejecutar `npm run dev` y comprobar:

1. Crear dos preguntas en la base a mano, una obligatoria de sí/no y una de texto largo.
2. Entrar a `/adopcion/<animal>/postular`: aparecen los tres campos de contacto y las dos preguntas.
3. Enviar sin completar la obligatoria: rechaza.
4. Enviar bien: redirige a la confirmación con la referencia.
5. Enviar de nuevo lo mismo: **no** crea una segunda postulación y muestra la misma confirmación.
6. Consultar `SELECT "textoPregunta", valor FROM "RespuestaPostulacion"` → las respuestas guardaron el texto de la pregunta.

- [ ] **Paso 6: Confirmar**

```bash
git add "src/app/adopcion" src/ui/postulaciones
git commit -m "feat: formulario público de postulación"
```

---

## Tarea 10: Consultas del panel

**Archivos:**
- Crear: `src/domains/postulaciones/consultas.ts`
- Prueba: `tests/unidad/postulaciones-consultas.test.ts`

**Interfaces:**
- Consume: `repositorioPostulacionesPrisma`, `armarFormulario`, `paraCache`/`desdeCache` de `@/domains/finanzas/consultas`.
- Produce: `preguntasDelFormularioDe(animalId)`, `postulacionesDelPanel(filtro)`, `detalleDePostulacion(id)`, `contarPorEstado()`, `filtrarPorRespuesta(postulaciones, respuestasPorPostulacion, texto)`.

- [ ] **Paso 1: Escribir la prueba del filtrado**

Crear `tests/unidad/postulaciones-consultas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filtrarPorRespuesta } from "@/domains/postulaciones/consultas";
import type { Postulacion, Respuesta } from "@/domains/postulaciones/tipos";

const postulacion = (id: string): Postulacion => ({
  id,
  animalId: "animal-1",
  estado: "NUEVA",
  nombre: `Persona ${id}`,
  email: `${id}@ejemplo.org`,
  telefono: "341 555 0000",
  anonimizadaEn: null,
  creadoEn: new Date(),
});

const respuesta = (postulacionId: string, texto: string, valor: string): Respuesta => ({
  id: `r-${postulacionId}`,
  postulacionId,
  preguntaId: "p1",
  textoPregunta: texto,
  tipo: "SI_NO",
  valor,
  orden: 0,
});

const postulaciones = [postulacion("a"), postulacion("b"), postulacion("c")];
const respuestas = new Map([
  ["a", [respuesta("a", "¿Tenés patio cerrado?", "sí")]],
  ["b", [respuesta("b", "¿Tenés patio cerrado?", "no")]],
  ["c", [respuesta("c", "¿Tenés patio cerrado?", "sí")]],
]);

describe("filtrarPorRespuesta", () => {
  it("deja solo las que responden lo buscado", () => {
    const resultado = filtrarPorRespuesta(postulaciones, respuestas, "sí");
    expect(resultado.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("busca también en el texto de la pregunta", () => {
    expect(filtrarPorRespuesta(postulaciones, respuestas, "patio")).toHaveLength(3);
  });

  it("ignora mayúsculas y acentos", () => {
    expect(filtrarPorRespuesta(postulaciones, respuestas, "SI")).toHaveLength(2);
  });

  it("sin texto de búsqueda devuelve todas", () => {
    expect(filtrarPorRespuesta(postulaciones, respuestas, "   ")).toHaveLength(3);
  });

  it("una postulación sin respuestas no rompe el filtro", () => {
    const conHuerfana = [...postulaciones, postulacion("d")];
    expect(filtrarPorRespuesta(conHuerfana, respuestas, "sí").map((p) => p.id)).toEqual(["a", "c"]);
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Ejecutar: `npx vitest run tests/unidad/postulaciones-consultas.test.ts`
Esperado: FALLA — no existe el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/domains/postulaciones/consultas.ts`:

```ts
import { unstable_cache } from "next/cache";
import { paraCache, desdeCache } from "@/domains/finanzas/consultas";
import { repositorioPostulacionesPrisma } from "@/infra/repositorios/postulaciones";
import { armarFormulario } from "./formulario";
import type { EstadoPostulacion, FiltroPostulaciones, Postulacion, Pregunta, Respuesta } from "./tipos";

/** Quita acentos y mayúsculas para comparar como compara una persona. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Filtra por lo que la gente respondió. Es la razón por la que las respuestas
 * son filas: con veinte postulaciones para un animal, poder ver solo las que
 * tienen patio cerrado cambia el trabajo de quien revisa.
 */
export function filtrarPorRespuesta(
  postulaciones: Postulacion[],
  respuestasPorPostulacion: Map<string, Respuesta[]>,
  busqueda: string
): Postulacion[] {
  const termino = normalizar(busqueda.trim());
  if (termino.length === 0) return postulaciones;

  return postulaciones.filter((postulacion) => {
    const respuestas = respuestasPorPostulacion.get(postulacion.id) ?? [];
    return respuestas.some(
      (r) => normalizar(r.valor).includes(termino) || normalizar(r.textoPregunta).includes(termino)
    );
  });
}

/**
 * El formulario que ve una persona. Se cachea porque lo pide cada visita a la
 * página de postulación, y cambia solo cuando la asociación edita preguntas.
 *
 * paraCache y desdeCache son obligatorios: unstable_cache guarda con
 * JSON.stringify a secas y devuelve texto donde había fechas.
 */
export const preguntasDelFormularioDe = unstable_cache(
  async (animalId: string) => paraCache(await armarFormulario(animalId, repositorioPostulacionesPrisma())),
  ["preguntas-del-formulario"],
  { tags: ["formulario"] }
) as unknown as (animalId: string) => Promise<Pregunta[]>;

/**
 * El listado del panel no se cachea: la bandeja tiene que mostrar lo que llegó
 * hace un minuto, y cachearla sería mostrar una bandeja vieja.
 */
export async function postulacionesDelPanel(filtro: FiltroPostulaciones): Promise<Postulacion[]> {
  return repositorioPostulacionesPrisma().listarPostulaciones(filtro);
}

export async function detalleDePostulacion(
  id: string
): Promise<{ postulacion: Postulacion; respuestas: Respuesta[] } | null> {
  const repositorio = repositorioPostulacionesPrisma();
  const postulacion = await repositorio.postulacionPorId(id);
  if (!postulacion) return null;
  return { postulacion, respuestas: await repositorio.respuestasDe(id) };
}

export async function contarPorEstado(): Promise<Record<EstadoPostulacion, number>> {
  const todas = await repositorioPostulacionesPrisma().listarPostulaciones({});
  const conteo = {
    NUEVA: 0,
    EN_REVISION: 0,
    CONTACTADA: 0,
    ENTREVISTA: 0,
    APROBADA: 0,
    RECHAZADA: 0,
    ADOPCION_CONCRETADA: 0,
  } satisfies Record<EstadoPostulacion, number>;

  for (const postulacion of todas) conteo[postulacion.estado]++;
  return conteo;
}

export async function respuestasPorPostulacion(ids: string[]): Promise<Map<string, Respuesta[]>> {
  const repositorio = repositorioPostulacionesPrisma();
  const mapa = new Map<string, Respuesta[]>();
  for (const id of ids) mapa.set(id, await repositorio.respuestasDe(id));
  return mapa;
}
```

Nota sobre `desdeCache`: `preguntasDelFormularioDe` la aplica al leer. Si el ejecutor prefiere hacerlo explícito, envolver la llamada en la página. Lo importante es que **ninguna consulta cacheada devuelva fechas convertidas en texto**.

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Ejecutar: `npx vitest run tests/unidad/postulaciones-consultas.test.ts`
Esperado: PASAN las 5.

- [ ] **Paso 5: Confirmar**

```bash
git add src/domains/postulaciones/consultas.ts tests/unidad/postulaciones-consultas.test.ts
git commit -m "feat: consultas del panel de postulaciones

La bandeja no se cachea: tiene que mostrar lo que llegó hace un minuto."
```

---

## Tarea 11: Panel — configurar el formulario

**Archivos:**
- Crear: `src/app/panel/(protegido)/formulario/page.tsx`, `formulario/acciones.ts`
- Prueba: manual (paso 4)

**Interfaces:**
- Consume: `crearPregunta`, `editarPregunta`, `archivarPregunta`, `reordenarPreguntas`.
- Produce: acciones `accionCrearPregunta`, `accionEditarPregunta`, `accionArchivarPregunta`, `accionReordenar`.

- [ ] **Paso 1: El contexto de postulaciones para las acciones**

Crear `src/app/panel/(protegido)/formulario/acciones.ts`, siguiendo el patrón de `finanzas/acciones.ts`:

```ts
"use server";

import { revalidateTag } from "next/cache";
import { auth } from "@/infra/auth";
import { prisma } from "@/infra/prisma";
import { repositorioPostulacionesPrisma } from "@/infra/repositorios/postulaciones";
import { auditoriaPrisma } from "@/infra/repositorios/animales";
import { crearPregunta, editarPregunta, archivarPregunta, reordenarPreguntas } from "@/domains/postulaciones/preguntas";
import type { ContextoPostulaciones, TipoRespuesta } from "@/domains/postulaciones/tipos";

export async function conContextoPostulaciones<T>(fn: (ctx: ContextoPostulaciones) => Promise<T>): Promise<T> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  return prisma.$transaction(async (tx) =>
    fn({
      usuarioEmail: sesion.user.email!,
      rol: sesion.user.rol as ContextoPostulaciones["rol"],
      repositorio: repositorioPostulacionesPrisma(tx),
      auditoria: auditoriaPrisma(tx),
    })
  );
}

export async function accionCrearPregunta(formulario: FormData) {
  const opcionesCrudas = String(formulario.get("opciones") ?? "").trim();
  await conContextoPostulaciones((ctx) =>
    crearPregunta(
      {
        texto: String(formulario.get("texto") ?? ""),
        tipo: String(formulario.get("tipo") ?? "TEXTO_CORTO") as TipoRespuesta,
        ayuda: String(formulario.get("ayuda") ?? "").trim() || null,
        // Una opción por línea: es lo que espera quien escribe una lista.
        opciones: opcionesCrudas.length > 0 ? opcionesCrudas.split("\n").map((o) => o.trim()).filter(Boolean) : [],
        obligatoria: formulario.get("obligatoria") === "on",
        animalId: (formulario.get("animalId") as string) || null,
      },
      ctx
    )
  );
  revalidateTag("formulario");
}

export async function accionEditarPregunta(id: string, formulario: FormData) {
  await conContextoPostulaciones((ctx) =>
    editarPregunta(
      id,
      {
        texto: String(formulario.get("texto") ?? ""),
        ayuda: String(formulario.get("ayuda") ?? "").trim() || null,
        obligatoria: formulario.get("obligatoria") === "on",
      },
      ctx
    )
  );
  revalidateTag("formulario");
}

export async function accionArchivarPregunta(id: string) {
  await conContextoPostulaciones((ctx) => archivarPregunta(id, ctx));
  revalidateTag("formulario");
}

export async function accionReordenar(idsEnOrden: string[]) {
  await conContextoPostulaciones((ctx) => reordenarPreguntas(idsEnOrden, ctx));
  revalidateTag("formulario");
}
```

- [ ] **Paso 2: La pantalla**

Crear `src/app/panel/(protegido)/formulario/page.tsx`: lista de preguntas del formulario base con su tipo y si es obligatoria, botones para subir y bajar, archivar y editar, y un formulario de alta.

El campo de opciones aparece solo cuando el tipo elegido las lleva. **La ayuda del campo tiene que decir "una opción por línea"**, porque es lo que la acción espera.

Las archivadas se muestran al final, atenuadas, con la aclaración de que ya no aparecen en el formulario pero siguen respaldando las respuestas viejas.

- [ ] **Paso 3: Preguntas propias de un animal**

En la pantalla de edición del animal (`panel/(protegido)/animales/[id]/page.tsx`), agregar una sección con las preguntas propias de ese animal, usando las mismas acciones con `animalId`.

- [ ] **Paso 4: Verificación manual**

1. Crear una pregunta de sí/no obligatoria → aparece en el formulario público.
2. Crear una de opción múltiple con una sola opción → la rechaza.
3. Reordenar → el formulario público cambia el orden.
4. Archivar una → desaparece del formulario público, y una postulación vieja que la respondió sigue mostrando el texto.
5. Intentar cambiarle el tipo a una existente → no está la opción en pantalla, y si se fuerza, el dominio la rechaza.

- [ ] **Paso 5: Confirmar**

```bash
git add "src/app/panel/(protegido)/formulario" "src/app/panel/(protegido)/animales"
git commit -m "feat: panel para configurar el formulario de postulación"
```

---

## Tarea 12: Panel — la bandeja

**Archivos:**
- Crear: `src/app/panel/(protegido)/postulaciones/page.tsx`, `postulaciones/[id]/page.tsx`, `postulaciones/acciones.ts`
- Modificar: `src/app/panel/(protegido)/page.tsx` (contador en el tablero)
- Prueba: manual (paso 4)

**Interfaces:**
- Consume: `postulacionesDelPanel`, `detalleDePostulacion`, `contarPorEstado`, `filtrarPorRespuesta`, `cambiarEstado`, `borrarDatosPersonales`, `cerrarOtrasPostulaciones`, `cambiarEstado` de animales.
- Produce: acciones `accionCambiarEstado`, `accionBorrarDatosPersonales`, `accionCerrarOtras`, `accionMarcarAnimal`.

- [ ] **Paso 1: Las acciones**

Crear `src/app/panel/(protegido)/postulaciones/acciones.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/infra/prisma";
import { auth } from "@/infra/auth";
import { repositorioPostulacionesPrisma } from "@/infra/repositorios/postulaciones";
import { repositorioPrisma, auditoriaPrisma } from "@/infra/repositorios/animales";
import { cambiarEstado, borrarDatosPersonales, cerrarOtrasPostulaciones } from "@/domains/postulaciones/gestion";
import { cambiarEstado as cambiarEstadoAnimal } from "@/domains/animales/servicio";
import type { Contexto as ContextoAnimales, EstadoAnimal } from "@/domains/animales/tipos";
import type { ContextoPostulaciones, EstadoPostulacion } from "@/domains/postulaciones/tipos";

async function conContexto<T>(fn: (ctx: ContextoPostulaciones) => Promise<T>): Promise<T> {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  return prisma.$transaction(async (tx) =>
    fn({
      usuarioEmail: sesion.user.email!,
      rol: sesion.user.rol as ContextoPostulaciones["rol"],
      repositorio: repositorioPostulacionesPrisma(tx),
      auditoria: auditoriaPrisma(tx),
    })
  );
}

export async function accionCambiarEstado(id: string, estado: EstadoPostulacion, comentario: string | null) {
  await conContexto((ctx) => cambiarEstado(id, estado, comentario, ctx));
  revalidatePath("/panel/postulaciones");
}

export async function accionBorrarDatosPersonales(id: string) {
  await conContexto((ctx) => borrarDatosPersonales(id, ctx));
  revalidatePath("/panel/postulaciones");
}

export async function accionCerrarOtras(animalId: string, exceptoId: string) {
  const cerradas = await conContexto((ctx) => cerrarOtrasPostulaciones(animalId, exceptoId, ctx));
  revalidatePath("/panel/postulaciones");
  return cerradas;
}

/**
 * Cambia el estado del animal. Es una acción aparte, y a propósito: el dominio
 * de postulaciones no toca animales. Esto lo dispara una persona desde el
 * panel, después de que el sistema se lo ofrece.
 */
export async function accionMarcarAnimal(animalId: string, estado: EstadoAnimal) {
  const sesion = await auth();
  if (!sesion?.user?.email || !sesion.user.rol) throw new Error("Sesión requerida");

  await prisma.$transaction(async (tx) =>
    cambiarEstadoAnimal(animalId, estado, {
      usuarioEmail: sesion.user.email!,
      // El rol real, no uno inventado para conformar al tipo. Escribir
      // `as "ADMINISTRACION"` acá dejaría pasar a cualquiera: el dominio
      // verifica el permiso sobre lo que reciba, y recibiría una mentira.
      rol: sesion.user.rol as ContextoAnimales["rol"],
      repositorio: repositorioPrisma(tx),
      auditoria: auditoriaPrisma(tx),
    })
  );
  revalidatePath("/panel/postulaciones");
}
```

- [ ] **Paso 2: La bandeja**

Crear `postulaciones/page.tsx`: contador por estado arriba, filtros por animal, por estado y **por respuesta**, y la lista con nombre, animal, estado, fecha.

Una postulación anonimizada se muestra con el nombre reemplazado por "Datos borrados a pedido" y sin acciones.

- [ ] **Paso 3: El detalle**

Crear `postulaciones/[id]/page.tsx`: contacto arriba, respuestas en orden, historial desde la bitácora, y el cambio de estado con comentario opcional.

**Las dos ofertas**, en un componente aparte que aparece solo cuando corresponde:

```tsx
"use client";

import { useTransition } from "react";
import { Boton } from "@/ui/componentes/Boton";
import { accionMarcarAnimal, accionCerrarOtras } from "../acciones";
import type { EstadoPostulacion } from "@/domains/postulaciones/tipos";

/**
 * Ofrece, no hace. El estado del animal y el cierre de las demás postulaciones
 * los decide una persona: un animal que figura como adoptado sin estarlo es un
 * error que se ve en público y que la asociación tiene que salir a explicar.
 *
 * Si nadie confirma, no pasa nada.
 */
export function Ofertas({
  estado,
  animalId,
  nombreAnimal,
  estadoAnimal,
  postulacionId,
  abiertasDelAnimal,
}: {
  estado: EstadoPostulacion;
  animalId: string;
  nombreAnimal: string;
  estadoAnimal: string;
  postulacionId: string;
  abiertasDelAnimal: number;
}) {
  const [pendiente, iniciarTransicion] = useTransition();

  const ofreceReservar = estado === "APROBADA" && estadoAnimal !== "RESERVADO";
  const ofreceAdoptado = estado === "ADOPCION_CONCRETADA" && estadoAnimal !== "ADOPTADO";
  const ofreceCerrar = estado === "ADOPCION_CONCRETADA" && abiertasDelAnimal > 0;

  if (!ofreceReservar && !ofreceAdoptado && !ofreceCerrar) return null;

  return (
    <aside>
      {ofreceReservar && (
        <p>
          ¿Marcar a {nombreAnimal} como reservado?{" "}
          <Boton
            variante="fantasma"
            tamano="sm"
            disabled={pendiente}
            onClick={() => iniciarTransicion(() => accionMarcarAnimal(animalId, "RESERVADO"))}
          >
            Marcar como reservado
          </Boton>
        </p>
      )}

      {ofreceAdoptado && (
        <p>
          ¿Marcar a {nombreAnimal} como adoptado?{" "}
          <Boton
            variante="fantasma"
            tamano="sm"
            disabled={pendiente}
            onClick={() => iniciarTransicion(() => accionMarcarAnimal(animalId, "ADOPTADO"))}
          >
            Marcar como adoptado
          </Boton>
        </p>
      )}

      {ofreceCerrar && (
        <p>
          Hay {abiertasDelAnimal}{" "}
          {abiertasDelAnimal === 1 ? "postulación abierta" : "postulaciones abiertas"} para {nombreAnimal}.
          Si no se cierran, quedan en la bandeja para siempre.{" "}
          <Boton
            variante="fantasma"
            tamano="sm"
            disabled={pendiente}
            onClick={() => iniciarTransicion(() => accionCerrarOtras(animalId, postulacionId))}
          >
            Rechazar las demás
          </Boton>
        </p>
      )}
    </aside>
  );
}
```

Y el botón de **borrar datos personales**, con confirmación previa que explique qué se borra y qué se conserva.

- [ ] **Paso 4: Verificación manual**

1. Enviar dos postulaciones para el mismo animal desde el sitio público.
2. En la bandeja: el contador muestra 2 en "nueva".
3. Filtrar por respuesta: escribir "sí" deja solo las que respondieron que sí.
4. Aprobar una: aparece la oferta de marcar el animal como reservado. **No aceptarla** y comprobar que el animal sigue disponible.
5. Pasarla a adopción concretada y aceptar las dos ofertas: el animal queda adoptado y la otra postulación, rechazada.
6. Borrar los datos personales de la otra: queda "Datos borrados a pedido", sin acciones, y las respuestas vacías.
7. Consultar la bitácora: hay una fila por cada acción.

- [ ] **Paso 5: Confirmar**

```bash
git add "src/app/panel/(protegido)/postulaciones" "src/app/panel/(protegido)/page.tsx"
git commit -m "feat: bandeja de postulaciones con estados y filtro por respuesta

El estado del animal no cambia solo: el panel lo ofrece y una persona
decide."
```

---

## Tarea 13: Invariantes de la entrega 3

**Archivos:**
- Crear: `tests/unidad/postulaciones-invariantes.test.ts`

**Interfaces:**
- Consume: todo lo anterior.
- Produce: nada; es una red de seguridad.

- [ ] **Paso 1: Escribir las pruebas**

Crear `tests/unidad/postulaciones-invariantes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { cambiarEstado, borrarDatosPersonales } from "@/domains/postulaciones/gestion";
import { crearPregunta } from "@/domains/postulaciones/preguntas";
import { enviarPostulacion } from "@/domains/postulaciones/envio";
import { repositorioPostulacionesEnMemoria } from "../dobles/repositorio-postulaciones-memoria";
import { auditoriaEnMemoria } from "../dobles/repositorio-animales-memoria";

function archivosDe(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => path.join(dir, f));
}

describe("invariantes de la entrega 3", () => {
  it("ninguna página importa el repositorio de postulaciones directamente", () => {
    const infractores = archivosDe("src/app")
      .filter((f) => !f.includes("acciones"))
      .filter((f) => /repositorios\/postulaciones/.test(readFileSync(f, "utf8")));
    expect(infractores, `saltean la capa de dominio: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("las postulaciones no entran al mapa del sitio", () => {
    const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
    expect(sitemap).not.toMatch(/postulacion/i);
  });

  it("no existe ninguna página pública que muestre una postulación", () => {
    const publicas = archivosDe("src/app").filter(
      (f) => !f.includes("panel") && f.endsWith("page.tsx")
    );
    const infractores = publicas.filter((f) => /detalleDePostulacion|postulacionesDelPanel/.test(readFileSync(f, "utf8")));
    expect(infractores, `exponen postulaciones sin sesión: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("el rol de finanzas no puede leer ni escribir postulaciones", async () => {
    const repositorio = repositorioPostulacionesEnMemoria();
    const auditoria = auditoriaEnMemoria();
    const ctxAnimales = { usuarioEmail: "a@b.c", rol: "ANIMALES" as const, repositorio, auditoria };

    const { postulacion } = await enviarPostulacion(
      { animalId: "animal-1", nombre: "Marina", email: "marina@ejemplo.org", telefono: "341 555 0000", respuestas: {} },
      repositorio,
      auditoria
    );

    const ctxFinanzas = { ...ctxAnimales, rol: "FINANZAS" as const };
    await expect(cambiarEstado(postulacion.id, "APROBADA", null, ctxFinanzas)).rejects.toThrow(/permiso/i);
    await expect(borrarDatosPersonales(postulacion.id, ctxFinanzas)).rejects.toThrow(/permiso/i);
    await expect(crearPregunta({ texto: "x", tipo: "SI_NO" }, ctxFinanzas)).rejects.toThrow(/permiso/i);
  });

  it("borrar los datos personales no deja rastro del contacto", async () => {
    const repositorio = repositorioPostulacionesEnMemoria();
    const auditoria = auditoriaEnMemoria();
    const ctx = { usuarioEmail: "a@b.c", rol: "ANIMALES" as const, repositorio, auditoria };

    const pregunta = await crearPregunta({ texto: "¿Tenés patio?", tipo: "SI_NO" }, ctx);
    const { postulacion } = await enviarPostulacion(
      { animalId: "animal-1", nombre: "Marina Gómez", email: "marina@ejemplo.org", telefono: "341 555 0000", respuestas: { [pregunta.id]: "sí" } },
      repositorio,
      auditoria
    );

    await borrarDatosPersonales(postulacion.id, ctx);

    // Ni en la postulación, ni en las respuestas, ni en la bitácora.
    const todo = JSON.stringify({
      postulaciones: repositorio.postulaciones,
      respuestas: repositorio.respuestas,
      auditoria: (auditoria as ReturnType<typeof auditoriaEnMemoria>).entradas,
    });
    expect(todo).not.toContain("marina@ejemplo.org");
    expect(todo).not.toContain("Marina Gómez");
    expect(todo).not.toContain("341 555 0000");
  });

  it("ninguna acción se inventa un rol para conformar al tipo", () => {
    // Escribir `rol: ... as "ADMINISTRACION"` saltea la verificación de
    // permisos: el dominio verifica sobre lo que recibe, y recibiría una
    // mentira. El rol tiene que viajar tal como vino de la sesión.
    const infractores = archivosDe("src/app")
      .filter((f) => /rol:\s*[^,
]*as\s+"(ADMINISTRACION|ANIMALES|FINANZAS|REDACCION)"/.test(readFileSync(f, "utf8")));
    expect(infractores, `se inventan un rol: ${infractores.join(", ")}`).toHaveLength(0);
  });

  it("el dominio de postulaciones no importa el de animales", () => {
    const infractores = archivosDe("src/domains/postulaciones").filter((f) =>
      /from "@\/domains\/animales\/servicio"/.test(readFileSync(f, "utf8"))
    );
    expect(
      infractores,
      `cambiar el estado del animal es decisión del panel, no del dominio: ${infractores.join(", ")}`
    ).toHaveLength(0);
  });
});
```

- [ ] **Paso 2: Ejecutar**

Ejecutar: `npx vitest run tests/unidad/postulaciones-invariantes.test.ts`
Esperado: PASAN las 7. Si alguna falla, **no se arregla la prueba**: se arregla el código.

- [ ] **Paso 3: Ejecutar la suite completa**

Ejecutar: `npm test`
Esperado: PASA todo, incluidas las 198 pruebas anteriores.

- [ ] **Paso 4: Confirmar**

```bash
git add tests/unidad/postulaciones-invariantes.test.ts
git commit -m "test: invariantes de la entrega 3

Verifican que las postulaciones no se filtren a ninguna página pública,
que finanzas no las toque, y que borrar los datos personales no deje
rastro del contacto en ningún lado, ni en la bitácora."
```

---

## Cobertura de la especificación

| Requisito de la spec | Tarea |
|---|---|
| §3.1 Preguntas del formulario y del animal | 1, 4 |
| §3.2 Postulaciones y respuestas | 1, 6 |
| §3.3 Contacto no configurable | 1, 6 |
| §3.4 Sin tabla de notas | 7 |
| §4.1 Armado del formulario | 5 |
| §4.2 Validación por tipo | 3 |
| §4.3 Qué pasa al cambiar una pregunta | 4, 6 |
| §5.1 Pantalla pública | 9 |
| §5.2 Envío transaccional | 6, 8 |
| §5.3 Control de envío repetido | 6, 8 |
| §6.1 Listado con filtro por respuesta | 10, 12 |
| §6.2 Detalle, estados y las dos ofertas | 12 |
| §6.3 Borrado a pedido | 7, 12 |
| §7 Privacidad y acceso | 13 |
| §8 Pruebas | 13 |

## Fuera de alcance

Notificaciones por correo o WhatsApp: entrega 4. Hasta entonces, alguien tiene que entrar al panel para ver las postulaciones nuevas.
