# Especificación técnica — Entrega 3: Postulaciones de adopción

**Versión:** 1.0
**Fecha:** 8 de septiembre de 2026
**Estado:** Aprobado
**Depende de:** [Entrega 1 — Núcleo de adopción](./2026-09-02-entrega-1-nucleo-adopcion-design.md) · [Sistema de Diseño v1](./2026-09-02-sistema-diseno-v1.md)

---

## 1. Alcance

### Incluye

Formulario de postulación configurable por la asociación, envío público sin registro, bandeja de gestión con los siete estados, filtrado por respuesta, y borrado de datos personales a pedido.

Al terminar esta entrega, la asociación deja de recibir postulaciones por mensaje privado de Facebook y pasa a tener una bandeja donde cada postulación tiene estado, historial y respuestas comparables entre sí.

### No incluye

Notificaciones por correo o WhatsApp: entrega 4. Cuando llega una postulación nueva, alguien tiene que entrar al panel para verla. Es una limitación conocida y aceptada para esta entrega.

### Tamaño

Menor que la entrega 2. No se parte en mitades.

---

## 2. Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| Alcance del formulario | Uno base, más preguntas propias por animal | La asociación no arma un formulario por animal, y las postulaciones siguen siendo comparables |
| Al editar una pregunta | Cada respuesta guarda el texto tal como se preguntó | Misma lógica que el libro contable: no se reescribe el pasado |
| Modelo de respuestas | Filas, no un bloque de datos | Permite filtrar por respuesta, que es lo que ahorra tiempo cuando hay veinte postulaciones para un animal |
| Datos personales | Se conservan; se borran a pedido | Decisión de la asociación. Conservar por defecto y borrar cuando alguien lo pide son compatibles |
| Formulario versionado completo | Descartado | Maquinaria pesada para un beneficio que el recorte por respuesta ya da casi entero |

### Sobre la retención de datos personales

La regla 4 del proyecto dice que **nada se borra**, y se decidió aplicarla también a las postulaciones. Esa regla se escribió para animales y asientos contables, donde conservar es lo correcto.

Aplicada a datos personales de terceros tiene una consecuencia que conviene tener presente: la asociación va a guardar nombre, teléfono, y lo que las preguntas configurables pidan —habitualmente DNI y domicilio— de gente que no adoptó y que no tiene ninguna relación con el refugio.

Por eso esta entrega incluye la **acción de borrado a pedido** (§6.3). No contradice la decisión: conservar por defecto y poder borrar cuando una persona lo solicita son cosas distintas. Si alguna vez la asociación quiere pasar a un borrado automático por antigüedad, el modelo ya lo soporta: es agregar una tarea programada que llame a la misma función.

---

## 3. Modelo de datos

### 3.1 Preguntas

```prisma
model FormularioAdopcion {
  id            String               @id @default(cuid())
  nombre        String               @default("Formulario base")
  preguntas     PreguntaFormulario[]
  actualizadoEn DateTime             @updatedAt
}

model PreguntaFormulario {
  id           String              @id @default(cuid())
  // Una pregunta pertenece al formulario base o a un animal, nunca a los dos.
  formularioId String?
  formulario   FormularioAdopcion? @relation(fields: [formularioId], references: [id])
  animalId     String?
  animal       Animal?             @relation(fields: [animalId], references: [id])

  texto        String
  ayuda        String?
  tipo         TipoRespuesta
  opciones     String[]            // solo para OPCION_MULTIPLE y SELECCION_MULTIPLE
  obligatoria  Boolean             @default(false)
  orden        Int
  // Se archiva, no se borra: igual que los animales.
  archivada    Boolean             @default(false)
  creadoEn     DateTime            @default(now())

  @@index([formularioId, orden])
  @@index([animalId, orden])
}

enum TipoRespuesta {
  TEXTO_CORTO
  TEXTO_LARGO
  SI_NO
  OPCION_MULTIPLE      // elige una
  SELECCION_MULTIPLE   // elige varias
  NUMERO
  EMAIL
  TELEFONO
}
```

Las preguntas base y las de un animal viven en la misma tabla. Separarlas en dos duplicaría la lógica de tipos, orden, obligatoriedad y validación.

### 3.2 Postulaciones

```prisma
model Postulacion {
  id            String                 @id @default(cuid())
  animalId      String
  animal        Animal                 @relation(fields: [animalId], references: [id])
  estado        EstadoPostulacion      @default(NUEVA)

  // Contacto: columnas propias, no preguntas configurables. Ver §3.3.
  nombre        String
  email         String
  telefono      String

  respuestas    RespuestaPostulacion[]
  // Queda marcado si alguien pidió que borraran sus datos.
  anonimizadaEn DateTime?
  creadoEn      DateTime               @default(now())
  actualizadoEn DateTime               @updatedAt

  @@index([animalId, estado])
  @@index([estado, creadoEn])
  // Contra el envío repetido por doble clic. Ver §5.3.
  @@index([animalId, email, creadoEn])
}

enum EstadoPostulacion {
  NUEVA
  EN_REVISION
  CONTACTADA
  ENTREVISTA
  APROBADA
  RECHAZADA
  ADOPCION_CONCRETADA
}

model RespuestaPostulacion {
  id            String        @id @default(cuid())
  postulacionId String
  postulacion   Postulacion   @relation(fields: [postulacionId], references: [id])
  // Puede quedar en null si la pregunta se archivó: la respuesta sobrevive igual.
  preguntaId    String?

  // El recorte: qué se preguntó exactamente, en ese momento.
  textoPregunta String
  tipo          TipoRespuesta
  // Siempre texto. El tipo dice cómo leerlo; una selección múltiple guarda
  // los valores separados por salto de línea.
  valor         String
  orden         Int

  @@index([postulacionId, orden])
}
```

### 3.3 Por qué el contacto no es configurable

Nombre, correo y teléfono son columnas de la postulación, siempre presentes. Todo lo demás —DNI, domicilio, si tiene patio, por qué quiere adoptar— es configurable.

Dos razones:

**La bandeja los necesita para el listado.** Mostrar "Marina Gómez — 341 555 0000" en una lista de veinte postulaciones exige tenerlos a mano, no repartidos entre las respuestas de cada una.

**El borrado a pedido necesita saber dónde están.** Si el contacto fuera una pregunta más, borrar los datos de una persona significaría adivinar cuáles de sus respuestas son personales. Con columnas propias, el objetivo es explícito.

### 3.4 Sin tabla de notas

El historial de una postulación es la secuencia de acciones administrativas sobre ella, y eso ya vive en `RegistroAuditoria`, indexado por entidad e identificador.

Los cambios de estado aceptan un comentario opcional que se guarda ahí, y el panel lo muestra como historial. Una tabla menos que mantener y una sola fuente de verdad sobre qué pasó.

---

## 4. El formulario configurable

### 4.1 Cómo se arma

El formulario que ve una persona son las preguntas activas del formulario base, ordenadas, seguidas de las preguntas activas propias de ese animal.

El panel permite crear, editar, reordenar y archivar preguntas, definir el tipo de respuesta y marcarlas obligatorias. Sin tocar código, que es el punto 12 del pedido original.

### 4.2 Validación

**Corre en el servidor y según el tipo de cada pregunta.** La validación del navegador es una comodidad para quien completa, no una garantía: el formulario se puede enviar sin navegador.

| Tipo | Qué se valida |
|---|---|
| `TEXTO_CORTO` | Hasta 200 caracteres |
| `TEXTO_LARGO` | Hasta 4000 caracteres |
| `SI_NO` | Exactamente "sí" o "no" |
| `OPCION_MULTIPLE` | El valor está entre las opciones definidas |
| `SELECCION_MULTIPLE` | Todos los valores están entre las opciones definidas |
| `NUMERO` | Es un número |
| `EMAIL` | Tiene forma de correo |
| `TELEFONO` | Entre 8 y 20 caracteres, solo dígitos, espacios, guiones, paréntesis y `+` |

Una pregunta obligatoria sin responder rechaza el envío. Los errores se muestran junto al campo que los produce, según la §5.14 del sistema de diseño.

### 4.3 Qué pasa cuando cambia una pregunta

Nada, para las postulaciones ya enviadas. Cada respuesta guardó el texto de la pregunta tal como se hizo, así que sigue siendo legible y sigue diciendo la verdad.

Si la pregunta se archiva, la respuesta conserva el texto y pierde el vínculo. Si se edita, la respuesta vieja mantiene la redacción anterior.

---

## 5. El flujo público

### 5.1 La pantalla

`/adopcion/<animal>/postular`. Sin registro, como manda el punto 21 del pedido original.

Arriba, el aviso de privacidad que ya existe en el prototipo: los datos son privados, los ve únicamente quien tiene permiso de adopciones, y nunca aparecen en la parte pública del sitio.

### 5.2 El envío

En una sola transacción: la postulación, sus respuestas y el asiento de auditoría. O quedan las tres, o no queda ninguna.

Después, una pantalla de confirmación con un número de referencia corto, con el mismo criterio que el libro contable, para que la persona pueda mencionarlo si llama.

### 5.3 Contra el envío repetido

Si llega una postulación con el mismo correo, para el mismo animal, dentro de los cinco minutos de la anterior, se devuelve la que ya existe en lugar de crear una nueva.

**Quien la envía ve la misma pantalla de confirmación, con el mismo número de referencia**, y no un error. Desde su lado el envío funcionó, porque efectivamente funcionó: su postulación está registrada. Mostrarle un error la llevaría a pensar que no quedó y a intentar otra vez.

Sin este control, un doble clic genera dos postulaciones idénticas y la asociación revisa dos veces a la misma persona. Cinco minutos alcanzan para cubrir el doble clic y el reintento por nervios, y no impiden que alguien se postule de verdad dos veces con días de diferencia.

---

## 6. La bandeja de gestión

### 6.1 Listado

Contador por estado, filtro por animal, por estado y **por respuesta**.

El filtro por respuesta es la razón por la que las respuestas son filas y no un bloque de datos: cuando veinte personas se postulan para el mismo perro, poder ver solo las que tienen patio cerrado cambia el trabajo de quien revisa.

### 6.2 Detalle y cambios de estado

Datos de contacto arriba, respuestas en el orden en que se preguntaron, historial abajo.

El cambio de estado acepta un comentario opcional que queda en la auditoría y se muestra en el historial.

**El estado del animal no cambia solo.** Al pasar una postulación a aprobada, el panel *ofrece* marcar al animal como reservado; al pasar a adopción concretada, ofrece marcarlo como adoptado. Ofrece, no hace.

Es la misma lógica que con el dinero: nada se mueve sin que alguien lo decida. Un animal que figura como adoptado por un cambio automático, cuando la adopción todavía no se concretó, es un error que se ve en público y que la asociación tiene que salir a explicar.

**Al concretar una adopción, el panel ofrece cerrar las demás postulaciones de ese animal**, en bloque. Si no, quedan diecinueve en estado "nueva" para siempre y la bandeja deja de servir para saber qué falta atender. También es una oferta, no un automatismo.

### 6.3 Borrado de datos personales a pedido

Una acción explícita, disponible para los roles con permiso de escritura sobre postulaciones.

Limpia nombre, correo, teléfono y el contenido de todas las respuestas. Conserva el caparazón: a qué animal se postuló, cuándo, y en qué estado terminó. Marca `anonimizadaEn`.

Queda auditada con quién la ejecutó y cuándo. No se ejecuta sola.

**Una postulación anonimizada queda de solo lectura:** no admite cambios de estado ni vuelve a la bandeja de pendientes. Sin contacto no hay nada que gestionar, y dejarla editable invitaría a moverla de estado como si todavía hubiera una persona del otro lado.

---

## 7. Privacidad y acceso

Las postulaciones **no tienen página pública, no entran al mapa del sitio y no tienen vista previa social**. No existe una dirección que las muestre sin sesión.

El permiso se verifica en la capa de dominio, con la tabla de la §7 de la entrega 1. Según esa tabla, **el rol de Finanzas no tiene ningún acceso a postulaciones, ni de lectura**. Eso se hace cumplir en el dominio, no escondiendo el menú.

Las postulaciones no se envían a ningún lado: no hay exportación ni correo en esta entrega.

---

## 8. Pruebas

Además de los casos normales, un grupo verifica **lo que el sistema no puede hacer**:

- Una postulación no aparece en ninguna página pública ni en el mapa del sitio.
- El rol de finanzas no puede leer postulaciones, aunque llame directo a la función.
- Una respuesta conserva el texto de la pregunta aunque después la editen o la archiven.
- Una pregunta obligatoria vacía rechaza el envío, y un correo inválido también.
- Una opción que no está entre las definidas rechaza el envío.
- Un envío repetido dentro de los cinco minutos no crea una segunda postulación.
- Borrar los datos personales deja el caparazón y no deja rastro del contacto.
- Aprobar una postulación no cambia el estado del animal por su cuenta.

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Nadie entra al panel y las postulaciones se acumulan sin respuesta | Limitación conocida hasta la entrega 4. El contador por estado en el panel la hace visible |
| Alguien envía cientos de postulaciones falsas | El control de repetidos cubre el doble clic, no un ataque deliberado. Si aparece, se agrega una barrera en la entrega 4 |
| Se acumulan datos personales de gente que no adoptó | Decisión tomada (§2). El borrado a pedido existe y el modelo soporta una limpieza automática si más adelante se decide |
| El formulario crece hasta volverse tedioso y la gente lo abandona | El panel permite recortar el formulario sin tocar código. **Medir el abandono no es posible en esta entrega:** haría falta registrar los formularios empezados y no enviados, y eso significaría guardar datos personales de gente que decidió no postularse, que es justo lo contrario de lo que conviene |

---

## 10. Siguiente paso

Plan de implementación, mediante la skill `writing-plans`.
