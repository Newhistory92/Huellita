# Especificación técnica — Entrega 4: Novedades y notificaciones

**Versión:** 1.0
**Fecha:** 15 de septiembre de 2026
**Estado:** Aprobado
**Depende de:** [Entrega 1](./2026-09-02-entrega-1-nucleo-adopcion-design.md) · [Entrega 2](./2026-09-02-entrega-2-finanzas-transparencia-design.md) · [Entrega 3](./2026-09-08-entrega-3-postulaciones-design.md) · [Sistema de Diseño v1](./2026-09-02-sistema-diseno-v1.md)

---

## 1. Alcance

### Incluye

Novedades enganchadas a un caso o a un animal, con foto y documento opcionales. La cuarta pestaña del caso financiero. Cola de avisos y notificaciones por correo al equipo del refugio.

Al terminar esta entrega, la asociación deja de tener que entrar al panel para enterarse de que llegó algo, y el caso financiero cuenta su historia completa: qué pasó, no solo cuánta plata entró y salió.

### Corrección de alcance respecto de lo anunciado

Al empezar esta entrega se anunció que incluiría "la gestión completa de documentos". **Eso era incorrecto.** Los documentos ya están implementados desde la entrega 2: el modelo, la subida desde el panel, la regla de que sin confirmar el tachado de datos personales el documento queda privado, la ruta que sirve los públicos a cualquiera y los privados solo a una sesión del panel, y el enlace al comprobante en la pestaña de gastos.

Lo único que esta entrega agrega sobre documentos es poder **adjuntar uno a una novedad**.

### No incluye

Correos hacia afuera —a quien se postula o dona—. Se decidió empezar solo con avisos internos, pero diseñando para que sumar destinatarios externos después no obligue a rehacer nada (§5.1).

Notificaciones por WhatsApp o push. El puerto de envío las admite como otra implementación, pero no se construyen acá.

### Dos mitades desplegables por separado

| Mitad | Contenido | Por qué se puede cortar ahí |
|---|---|---|
| **4A — Novedades** | Modelo, panel, cuarta pestaña del caso, novedades en la ficha del animal | No depende de Resend ni de ninguna cuenta nueva |
| **4B — Notificaciones** | Cola de avisos, puerto de correo, adaptador de Resend, ruta de vaciado | Depende de la cuenta de Resend y, para sumar gente al equipo, de verificar un dominio |

Si la verificación del dominio se demora, la 4A ya cierra el desvío que quedó anotado en la entrega 2.

---

## 2. Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| A qué se enganchan las novedades | A un caso o a un animal, nunca a los dos | Mismo patrón que las preguntas del formulario. Un modelo, dos lugares donde aparecen |
| Borradores | No hay: crear es publicar | Es contenido editorial, no un asiento. Se edita si salió con un error |
| Destinatarios de los avisos | Solo el equipo, por ahora | Escribirle a desconocidos suma entregabilidad, desuscripción y datos personales viajando |
| Cuándo se manda el correo | Nunca dentro de la transacción | Una caída de Resend no puede hacer fallar una donación verificada |
| Cómo se dispara | Cola de avisos en la base | Un aviso anotado no se pierde; permite reintentar y agrupar |
| Proveedor de correo | Resend, detrás de un puerto | Plan gratuito suficiente. El puerto permite cambiarlo sin tocar el dominio |

---

## 3. Novedades

### 3.1 Modelo

```prisma
model Novedad {
  id          String     @id @default(cuid())
  // Cuelga de un caso o de un animal, nunca de los dos.
  casoId      String?
  caso        CasoFinanciero? @relation(fields: [casoId], references: [id])
  animalId    String?
  animal      Animal?    @relation(fields: [animalId], references: [id])

  titulo      String
  cuerpo      String
  // Opcionales. La foto reutiliza el pipeline de imágenes de la entrega 1.
  fotoClave   String?
  fotoAlt     String?
  fotoAncho   Int?
  fotoAlto    Int?
  fotoPlaceholder String?
  documentoId String?
  documento   Documento? @relation(fields: [documentoId], references: [id])

  autorEmail  String
  // Se archiva, no se borra: igual que los animales y las preguntas.
  archivada   Boolean    @default(false)
  creadoEn    DateTime   @default(now())
  actualizadoEn DateTime @updatedAt

  @@index([casoId, creadoEn])
  @@index([animalId, creadoEn])
}
```

Prisma exige la relación inversa en los tres modelos que referencia: `novedades Novedad[]` en `CasoFinanciero`, en `Animal` y en `Documento`. La de `Animal` ya estaba anticipada en el esbozo de la entrega 1.

La foto se guarda desarmada en columnas en vez de reutilizar `FotoAnimal`, porque `FotoAnimal` pertenece a un animal y arrastra orden, principal y sensible — conceptos que no significan nada para una novedad, que tiene una sola imagen y no la oculta.

### 3.2 Reglas

**Sin borradores.** Crear es publicar. Una novedad se puede editar si salió con un error, y se archiva en vez de borrarse.

No es un asiento contable: corregir una redacción no es reescribir la historia. La regla de solo agregado protege el dinero, no el texto.

**Quién escribe:** administración, animales y redacción. Finanzas no, porque según la tabla de la §7 de la entrega 1 solo escribe dinero.

**Validación:** título de hasta 120 caracteres, cuerpo de hasta 4000. Una novedad tiene que colgar de exactamente un caso o un animal; ni de los dos ni de ninguno.

### 3.3 Dónde aparecen

**La cuarta pestaña del caso financiero**, junto a resumen, gastos y libro contable. Es la que quedó anotada como desvío en el plan de la entrega 2.

**La ficha del animal**, incluso después de adoptado. Esto último importa: el enlace que circuló por Facebook cuando Juanito buscaba familia sigue funcionando, y ahora además cuenta cómo le fue.

Las archivadas no aparecen en ninguna de las dos.

---

## 4. La cola de avisos

### 4.1 Modelo

```prisma
model AvisoPendiente {
  id          String    @id @default(cuid())
  tipo        TipoAviso
  // El hecho, no el correo ya escrito. Ver §4.2.
  datos       Json
  // Para no avisarle a quien hizo la acción. Ver §5.2.
  originadoPorEmail String?

  creadoEn    DateTime  @default(now())
  enviadoEn   DateTime?
  intentos    Int       @default(0)
  ultimoError String?

  @@index([enviadoEn, creadoEn])
}

enum TipoAviso {
  POSTULACION_NUEVA
  TRANSFERENCIA_PENDIENTE
  DONACION_VERIFICADA
  META_ALCANZADA
}
```

### 4.2 Cómo se anota

El dominio **no manda correos: anota que hay que avisar**, en la misma transacción que la acción.

Si la transacción se cae, el aviso tampoco queda. Si se confirma, el aviso está garantizado: una caída del proceso justo después no lo pierde, porque ya está en la base.

**Se guarda el hecho, no el correo redactado.** La fila dice "entró una donación verificada en el caso tal, por tanto", no el texto final. Si mañana se mejora la redacción, los pendientes salen con el texto nuevo.

**Los destinatarios no se guardan.** Se resuelven al enviar, consultando qué usuarios activos tienen los roles que corresponden. Si alguien se suma al equipo entre que se anotó el aviso y que salió, lo recibe; si alguien se fue, deja de recibirlo. Guardar la lista en la fila la congelaría en el momento equivocado.

### 4.3 Cómo se vacía

Una ruta `POST /api/tareas/avisos`, protegida por un secreto compartido en una cabecera. En producción la llama una tarea programada; en desarrollo, un comando de npm.

El vaciado:

1. Toma los avisos sin enviar, hasta doscientos por corrida. El tope existe para que una corrida no se eternice ni agote el límite del proveedor; lo que sobra sale en la siguiente.
2. Resuelve los destinatarios de cada uno por su tipo.
3. **Agrupa por destinatario**: si entraron veinte donaciones, sale un correo con las veinte, no veinte correos.
4. Manda, y marca los enviados.
5. Si el envío falla, suma un intento y guarda el error. La fila sigue pendiente.

**Después de cinco intentos deja de reintentar** y queda marcada como fallida, visible en el panel. Un aviso que falla en silencio para siempre es peor que uno que no se manda: nadie se entera de que el sistema de avisos dejó de funcionar.

**Vaciar dos veces no manda el mismo correo dos veces:** los enviados se marcan con fecha, y la consulta solo toma los que la tienen en nulo.

---

## 5. Qué se avisa y a quién

### 5.1 La tabla

| Tipo | Qué lo dispara | A qué roles |
|---|---|---|
| `POSTULACION_NUEVA` | Alguien envía una postulación | Animales, administración |
| `TRANSFERENCIA_PENDIENTE` | Alguien declara una transferencia | Finanzas, administración |
| `DONACION_VERIFICADA` | El webhook de Mercado Pago confirma un pago y genera su asiento | Finanzas, administración |
| `META_ALCANZADA` | Un caso pasa a meta alcanzada | Finanzas, administración |

Para sumar destinatarios externos más adelante, la resolución de destinatarios es el único lugar que cambia: se agrega la dirección de quien se postuló o donó, que ya está guardada. Nada del resto del diseño lo impide.

### 5.2 El criterio que ordena todo

**Se avisa lo que llega de afuera o lo que decide el sistema. No se avisa lo que hizo una persona del equipo.**

No disparan aviso: registrar un gasto, cambiar el estado de una postulación, publicar una novedad, verificar una transferencia, cerrar un caso. Todas las hace alguien del equipo, que ya sabe que las hizo.

Esto tiene una consecuencia que conviene explicitar, porque de otro modo se presta a confusión: **una donación que entra por transferencia verificada a mano no dispara `DONACION_VERIFICADA`**, aunque genere el mismo tipo de asiento que una de Mercado Pago. La diferencia no está en el asiento sino en el origen: la de Mercado Pago llegó de afuera y nadie la vio pasar; la transferencia la acaba de confirmar una persona del equipo, que ya sabe. Lo que sí avisa de la transferencia es su llegada, cuando queda pendiente de verificar.

**Y a quien ejecutó la acción no se le avisa de su propia acción.** Si Carla verifica una transferencia y eso generara un aviso, Carla no lo recibe. Por eso el aviso guarda `originadoPorEmail`.

Sin esta regla las notificaciones se vuelven ruido, y unas semanas después alguien las apaga. Esa es la peor falla posible de un sistema de avisos: no que mande de más, sino que consiga que lo desactiven.

---

## 6. El envío

### 6.1 El puerto

```ts
export interface CorreoParaEnviar {
  para: string[];
  asunto: string;
  cuerpo: string;
}

export interface ProveedorDeCorreo {
  readonly nombre: string;
  enviar(correo: CorreoParaEnviar): Promise<void>;
}
```

Dos implementaciones, elegidas por configuración igual que el almacén de archivos:

- **Resend** cuando hay clave configurada.
- **Consola** cuando no la hay: escribe el correo en la salida estándar. Permite trabajar y probar el flujo entero sin mandar un solo correo de verdad.

### 6.2 El contenido

**Texto plano con un enlace al panel** por cada cosa que pasó. No HTML con diseño.

Son avisos internos: quien los recibe quiere saber qué pasó y entrar a resolverlo. El texto plano además llega mejor y no se rompe en ningún cliente de correo.

El asunto dice cuántas cosas hay y de qué tipo, para que se entienda sin abrir.

### 6.3 La limitación de Resend

**Sin dominio verificado, Resend solo permite enviar a la dirección de la cuenta.**

Alcanza para desarrollar y para que la primera persona reciba los avisos. Cuando la asociación sume gente al equipo, hace falta verificar un dominio propio. Conviene resolverlo junto con el despliegue, que es cuando va a hacer falta el dominio de todos modos.

Hasta entonces, los avisos a direcciones no verificadas van a fallar, se van a reintentar cinco veces y van a quedar marcados como fallidos. Es el comportamiento correcto: visible, no silencioso.

---

## 7. Pruebas

Además de los casos normales:

- Si la acción falla, no queda el aviso anotado: van en la misma transacción.
- Vaciar la cola dos veces no manda el mismo correo dos veces.
- Un fallo de envío deja la fila pendiente y suma un intento, no la pierde.
- Después de cinco intentos deja de reintentar y queda marcada como fallida.
- A quien ejecutó la acción no le llega su propio aviso.
- Los destinatarios se resuelven al enviar: alguien que se suma al equipo recibe lo pendiente.
- Los avisos se agrupan por destinatario, no sale uno por hecho.
- Una novedad archivada no aparece en ninguna página pública.
- Una novedad tiene que colgar de exactamente un caso o un animal.
- La ruta que vacía la cola rechaza a quien no trae el secreto.

El proveedor de correo se reemplaza por un doble: el dominio depende del puerto, no de Resend.

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Nadie llama a la ruta de vaciado y los avisos se acumulan | El panel muestra cuántos hay pendientes y cuántos fallidos. En producción la llama una tarea programada |
| El secreto de la ruta se filtra | Solo permite disparar el envío de avisos ya anotados, no crear ninguno. El daño posible es que salgan antes de tiempo |
| Sin dominio verificado, los avisos al equipo fallan | Documentado en §6.3. Fallan visiblemente, no en silencio |
| Una novedad publica algo que no correspondía | Se edita o se archiva. No es un registro financiero |
| Veinte donaciones generan veinte correos | Se agrupan por destinatario en cada vaciado (§4.3) |

---

## 9. Siguiente paso

Plan de implementación, mediante la skill `writing-plans`, partido en las dos mitades de la §1.
