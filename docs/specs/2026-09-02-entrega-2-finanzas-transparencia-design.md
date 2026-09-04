# Especificación técnica — Entrega 2: Casos financieros y transparencia

**Versión:** 1.0
**Fecha:** 2 de septiembre de 2026
**Estado:** Aprobado
**Depende de:** [Entrega 1 — Núcleo de adopción](./2026-09-02-entrega-1-nucleo-adopcion-design.md) · [Sistema de Diseño v1](./2026-09-02-sistema-diseno-v1.md)

---

## 1. Alcance

### Incluye

Casos financieros con dirección permanente, libro contable inmutable, integración con Mercado Pago, transferencias bancarias verificadas a mano, gastos con comprobante, traslados entre casos, páginas públicas de caso y de transparencia, y el panel de finanzas.

Al terminar esta entrega, cualquiera puede seguir el recorrido completo de un peso donado: **entró → se gastó → acá está el comprobante → este es el saldo.**

### No incluye

Postulaciones de adopción (entrega 3). Notificaciones por correo o WhatsApp (entrega 4). La gestión general de documentos privados queda acotada a lo que necesitan los gastos.

### Corrección al modelo de la entrega 1

La especificación de la entrega 1 listaba una entidad `Pago` entre las del dominio financiero, pero **el bloque Prisma no la definía** y la implementación siguió el bloque. Esta entrega cubre ese hueco con `IntencionDonacion`, que cumple ese rol y además resuelve dos problemas que `Pago` no contemplaba (§3.1).

### Dos mitades desplegables por separado

El alcance es mayor que el de la entrega 1, así que se parte en dos mitades que llegan a producción de forma independiente:

| Mitad | Contenido | Valor al terminar |
|---|---|---|
| **2A — El libro** | Casos, asientos, gastos con comprobante, transferencias verificadas a mano, páginas públicas, panel | La asociación ya puede rendir cuentas en público, cargando los movimientos a mano |
| **2B — Los pagos** | Mercado Pago: intención, preferencia, aviso, verificación | Las donaciones entran solas y verificadas |

La 2A no depende de la 2B. Si la integración de pagos se demora por credenciales o por revisión de Mercado Pago, la transparencia ya está en línea.

---

## 2. Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| Flujo de pago | Checkout Pro con intención previa y reconsulta | Único que permite verificar en el backend y capturar la preferencia de anonimato |
| Excedente | Queda en el caso hasta que la comisión decida | La plata no se mueve sola; el traslado se asienta |
| Al alcanzar la meta | El caso sigue recibiendo donaciones | En una urgencia médica el presupuesto real suele superar al estimado |
| Transferencias | Misma entidad que las donaciones, verificadas por una persona | Son la misma cosa: alguien dice que está donando. Cambia quién verifica |
| Checkout transparente | Descartado | Manipular datos de tarjeta es un riesgo que no se justifica |

---

## 3. Modelo de datos

### 3.1 La pieza nueva

```prisma
model IntencionDonacion {
  id                String            @id @default(cuid())
  casoId            String
  caso              CasoFinanciero    @relation(fields: [casoId], references: [id])
  centavos          BigInt
  moneda            String            @default("ARS")

  // Lo que la persona decide antes de pagar. El aviso del proveedor no trae
  // nada de esto: allá nunca se le preguntó.
  nombreDonante     String?
  publicarNombre    Boolean           @default(false)
  mensaje           String?

  proveedor         String            // "mercadopago" | "transferencia"
  estado            EstadoIntencion   @default(INICIADA)
  referenciaExterna String?           // id de preferencia en el proveedor
  pagoExternoId     String?           // id del pago, cuando existe
  comprobanteId     String?           // solo transferencias: lo sube quien dona

  asiento           AsientoContable?
  creadoEn          DateTime          @default(now())
  resueltoEn        DateTime?

  @@index([casoId, estado])
  @@index([proveedor, pagoExternoId])
}

enum EstadoIntencion {
  INICIADA                  // se creó, la persona todavía no pagó
  PENDIENTE_VERIFICACION    // transferencia declarada, falta que alguien la confirme
  APROBADA                  // hay asiento
  RECHAZADA                 // el proveedor la rechazó, o Finanzas no la encontró en el extracto
  ABANDONADA                // se inició y nunca se completó
}
```

**Por qué existe.** Sin ella, la preferencia de anonimato solo podría deducirse del nombre del pagador que devuelve Mercado Pago: un dato personal que la asociación no necesita y que la §11 del sistema de diseño prohíbe publicar. Y los intentos que nunca se completan no dejarían rastro; si diez personas arrancan una donación y ninguna termina, eso es un problema del flujo que hay que poder ver.

**Sirve igual para las transferencias.** Una donación por Mercado Pago y una por transferencia son la misma cosa —alguien dice que está donando—; lo único que cambia es quién verifica: una API o una persona.

### 3.2 Cambios sobre lo existente

```prisma
model AsientoContable {
  // ... campos de la entrega 1
  intencionId String?            @unique
  intencion   IntencionDonacion? @relation(fields: [intencionId], references: [id])

  // Las dos puntas de un traslado entre casos quedan vinculadas.
  contraparteId String?          @unique
  contraparte   AsientoContable? @relation("Traslado", fields: [contraparteId], references: [id])
  reverso       AsientoContable? @relation("Traslado")
}
```

`Documento` se implementa acá con lo mínimo que necesitan los gastos: archivo, tipo, visibilidad pública o privada, y la confirmación de datos tachados de la §11.

### 3.3 Cómo se cuentan los donantes

`cantidadDonantes` es la cantidad de **intenciones aprobadas** del caso, no de personas distintas: sin pedir identificación no hay forma de saber si dos donaciones son de la misma persona, y pedirla para donar sería una barrera que la §1.1 del sistema de diseño no admite.

Se actualiza en la misma transacción que el asiento, igual que los saldos. La página pública lo dice como lo que es —"47 donaciones"— y no como "47 personas", porque afirmar lo segundo sería afirmar algo que el sistema no sabe.

---

## 4. El flujo del dinero

### 4.1 Donación por Mercado Pago

```
Persona elige monto y opciones
        ↓
Se registra la intención (INICIADA)
        ↓
Se crea la preferencia, con la intención como referencia externa
        ↓
La persona paga en Mercado Pago
        ↓
Llega el aviso  ──►  se valida la firma
        ↓
Se guarda el aviso tal como llegó
        ↓
Se consulta la API por ese pago      ← la verificación
        ↓
¿aprobado? ── no ──► se anota en la intención, no hay asiento
        ↓ sí
Transacción: asiento + saldos + intención + auditoría
```

**El aviso no se cree nunca.** Lo único que aporta es el número de pago; el estado se le pregunta a Mercado Pago con nuestro propio token. Un aviso falsificado no puede inventar plata.

### 4.2 Idempotencia en dos capas

Son dos barreras distintas y las dos hacen falta:

**Contra el aviso repetido.** `EventoWebhook` tiene clave única sobre proveedor más identificador del aviso. El segundo aviso idéntico choca contra la base y se descarta.

**Contra el pago contado dos veces.** `AsientoContable` tiene clave única sobre proveedor más número de pago.

La segunda no es redundante: Mercado Pago manda avisos **distintos** sobre el mismo pago cuando cambia de estado —pendiente y después aprobado—, y esos son avisos legítimos que no hay que descartar. Lo que no puede pasar es que generen dos asientos.

### 4.3 Respuestas al aviso

| Situación | Respuesta | Por qué |
|---|---|---|
| Procesado, o ya estaba procesado | 200 | Que Mercado Pago deje de reintentar |
| Pago verificado y no aprobado | 200 | Está resuelto: no hay nada que reintentar |
| Firma inválida | 401 | No es de Mercado Pago |
| Falla nuestra (base caída, API sin responder) | 500 | Que Mercado Pago reintente |
| El pago no aparece todavía en la API | 500 | Es una carrera, no un error: que reintente |

La última fila merece explicación. Si la firma es válida, el aviso **vino realmente de Mercado Pago**, así que ese pago existe: que la API todavía no lo devuelva es una carrera entre el aviso y la propagación interna de ellos, no un pago inventado. Por eso se pide el reintento en vez de darlo por perdido. Mercado Pago abandona solo cuando agota su propia serie de reintentos, y el evento queda guardado para poder investigarlo.

Un aviso con firma inválida nunca llega a esta tabla de decisiones: se rechaza antes, sin tocar la base.

### 4.4 Transferencia bancaria

```
Persona transfiere y lo declara en el sitio, con comprobante
        ↓
Intención en PENDIENTE_VERIFICACION   ← no suma al total público
        ↓
Finanzas la compara contra el extracto
        ↓
¿coincide? ── no ──► RECHAZADA, con motivo
        ↓ sí
Transacción: asiento + saldos + intención + auditoría
```

Lo pendiente se muestra en ámbar, con la leyenda de que no computa, y **nunca** entra en el total público.

---

## 5. Excedente y traslados

Al llegar a la meta el caso pasa a `META_ALCANZADA` pero **sigue recibiendo donaciones**: en una urgencia médica el presupuesto real suele superar al estimado, y cortar el botón de donar frustra a quien quiere ayudar igual.

El excedente queda visible como saldo del animal hasta que la comisión decida su destino.

**Un traslado son dos asientos en una sola transacción:** uno negativo en el caso de origen y uno positivo en el de destino, vinculados por `contraparteId`. Aparece en el libro público de los dos casos, con motivo, autor y fecha. No hay forma de mover plata sin dejar las dos puntas registradas.

---

## 6. Páginas públicas

### 6.1 `/ayudar/[slug]` — el caso

Dirección permanente. La primera pantalla responde tres preguntas antes de cualquier scroll: **quién es este animal, qué le pasó, cómo ayudo**.

Después: monto verificado con su sello, medidor, botón de donar, compartir, y cuatro pestañas — resumen, gastos con comprobante, libro contable y novedades. Cierra con el bloque que explica en lenguaje llano por qué se puede confiar en ese número.

Los casos cerrados siguen publicados para siempre, igual que las fichas de los animales adoptados.

### 6.2 `/ayudar` y `/transparencia`

El listado de casos abiertos, y la página general con los totales del año, la tabla de casos abiertos y cerrados, el tratamiento del excedente y la metodología numerada, escrita **sin vocabulario técnico**.

### 6.3 Renderizado

Igual que en la entrega 1: estático con revalidación por etiqueta. Un caso que se vuelve viral se sirve como archivo estático.

**La excepción son los importes.** Tras cada asiento se revalida la etiqueta del caso: si alguien dona y el número no se mueve, la transparencia se rompe justo donde más importa.

---

## 7. Panel de finanzas

Alta y edición de casos, con la **meta editable y el recaudado bloqueado con candado**, junto a la explicación de cuántos movimientos lo componen.

Registro de gastos con comprobante. Bandeja de transferencias pendientes. Traslado de excedente entre casos.

**El ajuste contable** exige motivo y respaldo, y crea un asiento nuevo de tipo `AJUSTE` que apunta al original. No hay ninguna pantalla que modifique un asiento existente, porque el disparador de la base lo rechazaría.

Los permisos salen de la tabla de la §7 de la entrega 1: solo Administración y Finanzas escriben dinero, y se verifica en la capa de dominio.

---

## 8. Pruebas

Además de los casos normales, un grupo verifica **lo que el sistema no puede hacer**:

- Un mismo pago no genera dos asientos, aunque lleguen dos avisos distintos sobre él.
- Un aviso con firma inválida se rechaza y no crea nada.
- Un aviso repetido no se reprocesa.
- Una transferencia pendiente no suma al total público.
- Un ajuste sin motivo o sin respaldo se rechaza.
- Un traslado siempre deja las dos puntas, o ninguna.
- El saldo guardado coincide con la suma de los asientos.
- Nadie fuera del dominio de finanzas puede escribir el recaudado.

La API de Mercado Pago se reemplaza por un doble en las pruebas: el dominio depende de un puerto, no del proveedor.

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Un aviso llega antes de que el pago esté disponible en la API | Se responde 500 y Mercado Pago reintenta; el evento queda guardado |
| La verificación diaria detecta una diferencia de saldos | Queda en auditoría y avisa a Administración: significa que alguien tocó la base por fuera |
| Se publica un comprobante con datos personales | El panel exige confirmar el tachado antes de marcarlo público; sin esa confirmación queda privado |
| Mercado Pago demora la habilitación de la cuenta | La mitad 2A no depende de la 2B |

---

## 10. Siguiente paso

Plan de implementación, mediante la skill `writing-plans`, partido en las dos mitades de la §1.
