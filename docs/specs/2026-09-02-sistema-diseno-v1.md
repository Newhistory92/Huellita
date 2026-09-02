# Sistema de Diseño — Plataforma Huellas

**Versión:** 1.0
**Fecha:** 2 de septiembre de 2026
**Estado:** Aprobado
**Alcance:** Sistema de diseño únicamente. No cubre modelo de datos, API, webhooks ni infraestructura.
**Prototipo de referencia:** https://claude.ai/code/artifact/3cec744b-45df-42d9-b539-df4df5338440

---

## 1. Fundamentos

Cuatro principios gobiernan todas las decisiones de este documento. Ante una duda que el documento no resuelva, se resuelve a favor del principio.

### 1.1 Primero el teléfono, y desde Facebook

La mayoría de las visitas llega desde un enlace compartido en Facebook, en un teléfono, con conexión de datos. En consecuencia: el diseño se define primero a 375px y se expande hacia arriba; ninguna pantalla exige registro previo; y toda página de destino explica su caso en el primer scroll.

### 1.2 La transparencia tiene que ser legible antes que completa

Un balance exhaustivo que nadie entiende no genera confianza. La jerarquía es siempre: primero el número que resume, después el detalle que lo respalda. Un dato financiero nunca se muestra sin su contexto.

### 1.3 Nadie ve una imagen fuerte sin elegirlo

Las fotos de rescate pueden mostrar animales lastimados. Ninguna imagen marcada como sensible se muestra directamente: se difumina, se avisa qué contiene y se abre solo por acción de la persona. Esta regla no admite excepción por urgencia del caso.

### 1.4 Dos registros visuales, una sola identidad

La zona emocional (portada, adopción, historias) puede ser cálida. La zona contable (casos financieros, transparencia, panel) debe verse sobria. La tipografía, el color y la densidad cambian entre ambas; los componentes y los tokens no.

---

## 2. Tokens

Todos los valores se declaran como variables CSS. Ningún componente escribe un color, un radio o una duración literal.

### 2.1 Los tres estados de tema

El tema tiene **tres** estados, no dos, y los tres deben resolverse:

1. `:root` sin marcar — define la paleta clara completa.
2. `@media (prefers-color-scheme: dark)` con guarda `:root:not([data-theme="light"])` — redefine **solo** los tokens.
3. `:root[data-theme="dark"]` — redefine los mismos tokens para que la elección explícita gane.

**Regla dura:** ningún color puede tener su única definición dentro de un bloque de media query o `[data-theme]`. El estado más común entre los visitantes es el sistema sin marcar; un color definido solo detrás de `[data-theme]` no se aplica ahí y produce texto de un tema sobre el fondo del otro.

### 2.2 Paleta

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--ground` | `#E9E9E7` | `#14120F` | Fondo de página |
| `--surface` | `#FFFFFF` | `#1C1A17` | Tarjetas, campos, superficies elevadas |
| `--surface-2` | `#F2F2F0` | `#252220` | Fondos secundarios, campos bloqueados |
| `--ink` | `#191714` | `#EDEAE5` | Texto principal |
| `--ink-2` | `#635D56` | `#A79F97` | Texto secundario |
| `--ink-3` | `#6E6862` | `#968E86` | Etiquetas, metadatos |
| `--line` | `#DCDAD5` | `#2E2B27` | Bordes y divisiones |
| `--line-strong` | `#C3BFB8` | `#413D38` | Bordes de control |
| `--brand` | `#191714` | `#EDEAE5` | Fondo de botón primario |
| `--on-brand` | `#FFFFFF` | `#14120F` | Texto sobre botón primario |
| `--mark` | `#0E6B57` | `#4FBFA1` | Marca e interfaz |
| `--accent` | `#B85416` | `#F09B5E` | Dinero |
| `--accent-soft` | `#FBEADC` | `#33231A` | Fondo de acento |
| `--on-accent` | `#FFFFFF` | `#2B1408` | Texto sobre acento |
| `--ok` | `#15633C` | `#5FBF8C` | Ingreso verificado |
| `--warn` | `#79571A` | `#D3AC5F` | Pendiente de verificación |
| `--bad` | `#96271A` | `#E58274` | Egreso, urgencia, rechazo |

Cada color de estado tiene su variante `-soft` para fondos.

El neutro no es un gris puro: está sesgado hacia el cálido para acompañar al acento. Es una elección, no una omisión.

### 2.3 Elevación

| Token | Uso |
|---|---|
| `--shadow-sm` | Reposo de tarjetas e indicadores |
| `--shadow` | Elementos flotantes (CTA fijo, aviso emergente) |
| `--shadow-lift` | Estado hover de tarjetas e indicadores |
| `--tshadow` | Sombra de texto en nombres y números |
| `--tshadow-display` | Sombra de tres capas del titular principal |

`--tshadow-display` combina un filo claro superior, una sombra corta de cuerpo y un halo amplio. En oscuro el filo se apaga y las sombras se profundizan.

### 2.4 Forma y espacio

| Token | Valor | Uso |
|---|---|---|
| `--radius` | `16px` | Tarjetas, avisos, cintas |
| `--radius-sm` | `12px` | Contenedores internos |
| `--radius-xs` | `10px` | Campos, miniaturas |
| — | `999px` | Botones, píldoras, chips, medidor |

Escala tipográfica: `0.75 / 0.8438 / 1 / 1.125 / 1.4375 / 1.9375 / 2.75 rem`. El titular sube a `3.25rem` desde 620px.

Ancho de lectura: 640px en móvil y hasta 880px en escritorio. El texto corrido no supera los 60 caracteres por línea.

Las agrupaciones se espacian con `gap` sobre flex o grid. No se usan márgenes por elemento: colapsan y se duplican de forma silenciosa.

---

## 3. Regla de color semántico

**Esta es la regla más importante del sistema.** Protege el argumento central del producto: si algo está en naranja, es dinero.

| Color | Uso exclusivo | Prohibido |
|---|---|---|
| **Naranja** `--accent` | Botón de donar, barra de recaudación, CTA fijo de donación, énfasis en el flujo del dinero | Cualquier estado de interfaz, navegación, foco o etiqueta no financiera |
| **Verde marca** `--mark` | Logo, subrayado de pestaña activa, anillo de foco, marcador de novedad, etiqueta "Adoptada", íconos de aliados | Importes |
| **Verde contable** `--ok` | Ingresos verificados, montos recibidos, estado confirmado | Acciones |
| **Rojo** `--bad` | Egresos, urgencia, rechazo | Errores de formulario que no sean bloqueantes |
| **Ámbar** `--warn` | Pendiente de verificación, en tratamiento | Nada confirmado |
| **Tinta** `--brand` | Botón primario no financiero, chip seleccionado | — |

Consecuencia práctica: el botón primario del sitio es **negro tinta**, no de color. Un botón de color compite con la señal de donación y baja la percepción de calidad.

---

## 4. Tipografía

### 4.1 Las tres familias y su rol

| Familia | Rol | Regla |
|---|---|---|
| **Fraunces** | Titular de portada y logo | Con `SOFT 100` y `WONK 1`. Serif de alta gama con terminaciones redondeadas: cálida sin ser infantil |
| **Manrope** | Interfaz y texto corrido | Todo lo demás: títulos de sección, botones, etiquetas, párrafos |
| **IBM Plex Mono** | Datos auditables | Importes, identificadores de transacción, fechas del libro, porcentajes, URLs |

**Decisión aprobada:** la tipografía cálida queda **solo en el titular de portada y el logo**. Los títulos de sección, los importes y el libro contable mantienen el registro sobrio. La parte que emociona puede ser tierna; la parte donde se rinde cuenta de la plata tiene que verse seria.

Se admiten exactamente **dos excepciones de exhibición**, ambas fuera de la zona contable: los nombres de las veterinarias en la cinta de aliados y el título de la compuerta de imagen sensible. Cualquier uso adicional de Fraunces requiere aprobación: es la pieza que más rápido corre el sistema hacia lo genérico.

**Regla de la monoespaciada:** aparece únicamente donde el dato tiene que poder auditarse. Usarla como recurso decorativo en etiquetas de interfaz vuelve la pantalla rígida y le quita significado donde sí importa. Toda columna de dígitos lleva `font-variant-numeric: tabular-nums`.

### 4.2 Reglas de composición

- Interlineado del cuerpo: 1.6. De los títulos: 1.06 a 1.2.
- Los títulos llevan `text-wrap: balance` y tracking negativo (−0.018em a −0.03em).
- Las etiquetas en versalitas llevan tracking positivo (0.1em a 0.13em) y peso 700.
- Tamaño mínimo de texto de cuerpo: 16px. Ningún texto informativo baja de 12px.
- Toda familia declara su pila de reserva real.

---

## 5. Inventario de componentes

Cada componente define sus estados. Un estado no declarado es un estado que la implementación va a inventar.

### 5.1 Botón

Tres variantes: **donar** (naranja, ancho completo), **primario** (tinta) y **fantasma** (borde, fondo transparente). Dos tamaños: normal (50px de alto) y chico (42px). Siempre en cápsula.

Estados: reposo, hover (elevación de 1px y oscurecimiento), activo (vuelve a su posición), foco visible, deshabilitado. El ícono del botón tiene su propio movimiento en hover: la huella rota, el corazón crece.

### 5.2 Chip de filtro

Cápsula de 42px con borde. Estado seleccionado: fondo tinta, texto invertido. Se comunica con `aria-pressed`, no solo con color.

### 5.3 Píldora de estado

Versalitas en cápsula, con punto de color opcional. Variantes: confirmado, pendiente, rechazado, neutro, marca, adoptado. **Nunca comunica su significado solo por color**: siempre lleva texto.

### 5.4 Tarjeta

Superficie con borde de 1px, radio 16px y sombra suave. Variante elevable: al hover sube 2px y profundiza la sombra. Una tabla ancha dentro de una tarjeta lleva su propio contenedor con desplazamiento horizontal y padding propio — nunca al ras del borde.

### 5.5 Indicador

Cuatro niveles obligatorios, en este orden:

1. Ícono en círculo, teñido según el tipo de dato.
2. Etiqueta en versalitas, arriba.
3. Número grande en monoespaciada, con contador animado.
4. Línea de contexto, separada por un guion fino.

La cuarta línea no es opcional: un número solo es una afirmación; un número con su contexto es un dato. Variantes `--money` (verde) y `--spent` (rojo) tiñen el ícono, el número y la línea de luz superior.

### 5.6 Medidor de recaudación

Riel de 7px en cápsula, relleno naranja, animado en 1.1s al entrar a la pantalla. Debajo, siempre: monto verificado, meta, faltante, porcentaje y cantidad de donantes.

### 5.7 Fila de caso

Miniatura cuadrada de 88px (112px en escritorio) más cuerpo con estado, título, resumen, medidor y acción. Es el formato **obligatorio** para listar casos en portada: la tarjeta con foto grande queda reservada para la página propia del caso.

### 5.8 Libro contable

Filas con concepto, fecha, proveedor, importe alineado a la derecha en monoespaciada, y una fila de metadatos con el identificador de transacción y el enlace al comprobante. Los importes de entrada en verde con signo +, los de salida en rojo con signo −.

### 5.9 Línea de tiempo

Riel vertical de 1px con marcadores circulares de 18px. Tres tipos: ingreso (verde), egreso (rojo) y novedad (verde marca). Cada entrada lleva fecha en versalitas y cuerpo con el hecho.

### 5.10 Enlace a comprobante

Cápsula con ícono de documento y nombre del comprobante en monoespaciada. Al hover se tiñe de verde marca. Área mínima de 34px de alto.

### 5.11 Compuerta de imagen sensible

Capa de vidrio sobre la imagen difuminada, con: ícono de ojo en círculo, título de qué se va a ver y aclaración. Todo el panel es el botón. Al abrirse, la capa se desvanece y el desenfoque se retira en 0.5s. En miniatura se muestra solo el ícono.

**No se cierra sola ni se recuerda entre visitas.** Cada carga de página vuelve a difuminar.

### 5.12 Cinta de aliados

Banda a sangre, de borde a borde de la pantalla, sin caja ni fondo. Desplazamiento continuo de 52s en lineal, con degradados del color del papel en ambos extremos. Cada ficha: ícono, nombre en Fraunces de 20px y **dirección**, ambos con sombra de texto.

La ficha muestra nombre y dirección, nada más. El descuento acordado no se exhibe: se menciona en el texto de la sección. La cinta funciona como reconocimiento y como referencia de dónde queda cada veterinaria, no como cartel de precios.

Requisitos obligatorios: se detiene al hover y al foco; tiene botón visible de pausa que refleja su estado en `aria-pressed`; el grupo duplicado va con `aria-hidden`; y bajo `prefers-reduced-motion` se convierte en una grilla estática sin duplicados ni degradados.

### 5.13 Pestañas

Etiqueta con subrayado de 2px en verde marca que crece desde la izquierda. En hover llega al 40%; activa, al 100%. Se comunica con `aria-selected` y paneles con `role="tabpanel"`.

### 5.14 Formulario

Etiqueta visible siempre — **nunca** el marcador de posición como única etiqueta. Campo de 50px de alto, radio 10px, con anillo de foco. El texto de ayuda va debajo del campo. El error va junto al campo que lo produce, no agrupado arriba.

Un campo calculado se muestra **bloqueado con candado** y con la explicación de cómo se calculó (ver §11).

### 5.15 Aviso

Bloque en superficie con borde. Variante de advertencia con fondo ámbar. Sirve para explicar reglas del sistema, no para decorar.

### 5.16 CTA fijo

Barra en cápsula, pegada al pie del contenido, con fondo de vidrio y sombra. Lleva el monto a la izquierda y el botón de donar a la derecha. Solo en páginas de caso y de animal.

### 5.17 Aviso emergente

Cápsula oscura centrada al pie, de 2.4s, con `role="status"` y `aria-live="polite"`. Confirma una acción; nunca comunica un error bloqueante.

---

## 6. Patrones de pantalla

### 6.1 Portada

Orden fijo: título y bajada; dos acciones (adoptar / ayudar); tres indicadores; casos abiertos en filas compactas; cinta de aliados; explicación de cómo funciona el dinero; animales en adopción.

**La portada no abre con una foto grande.** Es la regla que evita que una imagen de rescate sea lo primero que ve alguien que llega sin contexto.

### 6.2 Ficha de animal

Galería, datos clave en grilla, personalidad, salud, requisitos, botones de compartir, vista previa de cómo se ve el enlace compartido, y CTA fijo de postulación. La ficha **sobrevive a la adopción**: cambia el estado a "Adoptada", nunca se despublica.

### 6.3 Caso financiero

Primera pantalla obligatoria — responde tres preguntas antes de cualquier scroll: **quién es este animal, qué le pasó, cómo ayudo.**

Después: monto verificado con su sello, medidor, botón de donar, compartir, y las cuatro pestañas — Resumen, Gastos, Libro contable y Novedades. Cierra con el bloque de por qué se puede confiar en ese número.

### 6.4 Transparencia

Cuatro indicadores, tabla de casos abiertos y cerrados, tratamiento del excedente, metodología en lenguaje llano numerada, e historias que terminaron bien.

La metodología se escribe **sin vocabulario técnico**. "Cuando el pago se confirma, el sitio vuelve a preguntarle a Mercado Pago si ese pago existe y está aprobado, antes de contarlo."

### 6.5 Panel interno

Indicadores de gestión, transferencias pendientes con acción de verificar, edición del caso con el campo calculado bloqueado, últimos movimientos y tabla de permisos por rol.

---

## 7. Imágenes

- Proporciones: 4:3 en tarjetas, 16:11 en encabezado de caso, 1:1 en miniaturas y galería.
- Toda imagen lleva texto alternativo descriptivo. Las decorativas van con `aria-hidden`.
- Formato moderno (WebP/AVIF), carga diferida fuera de la primera pantalla y **espacio reservado** para que la página no salte.
- Cada imagen tiene una marca de sensible que el panel controla (§5.11).
- Cada animal y cada caso tiene su imagen de vista previa social, con proporción y peso controlados.

---

## 8. Movimiento

| Elemento | Duración | Curva |
|---|---|---|
| Cambio de color y borde | 0.18s | ease |
| Elevación y desplazamiento | 0.3s | `cubic-bezier(.22,1,.3,1)` |
| Íconos dentro de botones | 0.4s | `cubic-bezier(.34,1.56,.5,1)` |
| Medidor de recaudación | 1.1s | `cubic-bezier(.22,.8,.3,1)` |
| Contadores | 1.2s | cúbica de salida |
| Cinta de aliados | 52s | lineal, en bucle |

Se animan opacidad y `transform`. **No** se animan ancho, alto ni posición: provocan recálculo de la página.

Bajo `prefers-reduced-motion`: las transiciones se reducen a lo imperceptible, se anulan las elevaciones al hover, los contadores muestran su valor final directamente y la cinta se detiene y se convierte en grilla.

---

## 9. Accesibilidad

Requisitos de cumplimiento obligatorio antes de publicar cualquier pantalla:

- **Contraste** de 4.5:1 en texto y 3:1 en elementos de interfaz, verificado en los dos temas.
- **Foco visible** en todo elemento interactivo: anillo de 2px en verde marca con 3px de separación. Nunca se elimina el indicador de foco.
- **Área táctil** mínima de 44×44px, con al menos 8px de separación entre objetivos.
- **Teclado**: toda la interfaz operable sin mouse, en orden lógico, sin trampas de foco.
- **Lectores de pantalla**: los íconos solos llevan etiqueta accesible; los decorativos van ocultos; los estados se comunican con `aria-pressed`, `aria-selected` y `aria-current`, no solo con color.
- **Emoji**: nunca como ícono de interfaz. Un emoji dentro de un texto va marcado como decorativo para que no se lea en medio de la oración.
- **La cinta infinita** cumple lo especificado en §5.12. El movimiento perpetuo sin control es una barrera, no un adorno.
- **Zoom** habilitado; nada se rompe al 200%.
- Ninguna pantalla desplaza horizontalmente el cuerpo de la página.

---

## 10. Contenido y tono

- Se nombran las cosas como las nombra la gente, no como las nombra el sistema: "novedades del caso", no "actualizaciones de entidad".
- Voz activa. El botón dice exactamente qué pasa: "Verificar y asentar", no "Aceptar".
- Los errores explican qué pasó y cómo se arregla. Sin disculpas ni vaguedad.
- Moneda y fechas en formato argentino: `$327.500`, `65,5%`, `12 de septiembre`.
- Los importes siempre con su contexto: monto, meta y faltante juntos; nunca un número solo.
- Lo pendiente se nombra pendiente, en el mismo lugar donde se muestra lo confirmado.

---

## 11. Reglas de diseño derivadas de la transparencia

Estas reglas son de diseño, no de backend, y son obligatorias en la interfaz:

1. **El monto recaudado se muestra siempre como campo calculado**, en solo lectura, con ícono de candado y la explicación de cuántos movimientos lo componen. La meta, en cambio, es editable: es un objetivo, no un hecho contable.
2. **Lo pendiente nunca se ve como confirmado.** Las transferencias sin verificar se muestran en ámbar, con la leyenda de que no computan al total público, y con su monto en gris.
3. **Todo gasto muestra su comprobante**, o dice explícitamente que no lo tiene. Un gasto sin respaldo visible se ve incompleto a propósito.
4. **Un ajuste contable se ve como un movimiento nuevo**, con autor, fecha, motivo y respaldo; nunca como una edición del historial.
5. **Los casos cerrados siguen publicados** y accesibles con la misma dirección de siempre.
6. **El número verificado lleva su sello** y, junto a él, la explicación de por qué se puede confiar en él.
7. **Ningún comprobante publicado muestra datos personales de ninguna persona** — ni del donante, ni del profesional, ni de quien adopta. Antes de publicarse, el documento se sube con esos datos tachados; el sitio muestra el concepto, el importe, la fecha y el número de comprobante. La interfaz de carga del panel debe pedir esa confirmación de forma explícita antes de marcar un documento como público. Un documento sin confirmar queda privado.

---

## 12. Decisiones resueltas

| # | Decisión | Resolución | Fecha |
|---|---|---|---|
| 1 | Qué muestra la ficha de la cinta de aliados | **Nombre y dirección, nada más.** El descuento no se publica en la cinta: el convenio comercial se menciona en el texto de la sección, no se exhibe como precio | 2/9/2026 |
| 2 | Datos personales en los comprobantes publicados | **No se publican datos personales de ninguna persona.** Ver §11, regla 7 | 2/9/2026 |

No quedan decisiones abiertas en la versión 1.0.

---

## 13. Versionado

Este documento describe la versión 1.0 del sistema, aprobada sobre el prototipo del 2 de septiembre de 2026.

Cualquier cambio en la §3 (color semántico), la §4 (roles tipográficos), la §9 (accesibilidad) o la §11 (reglas de transparencia) requiere una nueva versión y aprobación explícita: son las reglas que sostienen la credibilidad de la plataforma. El resto puede evolucionar con la implementación, documentando el cambio.
