# Especificación técnica — Entrega 1: Núcleo de adopción

**Versión:** 1.0
**Fecha:** 2 de septiembre de 2026
**Estado:** Aprobado
**Depende de:** [Sistema de Diseño v1](./2026-09-02-sistema-diseno-v1.md)

---

## 1. Alcance

### Incluye

Animales con ficha pública permanente, listado con filtros, galería de fotos, estados del animal, panel de administración, pipeline de imágenes, SEO con Open Graph, y compartir en redes.

Al terminar esta entrega, la asociación puede dejar de depender de Facebook para las adopciones.

### No incluye

Casos financieros, libro contable, pagos, transparencia pública, postulaciones de adopción, documentos de respaldo y notificaciones. Cada uno tiene su propia entrega.

**Salvedad importante:** el modelo de datos se diseña **completo** en esta entrega, incluidas las tablas financieras y de postulaciones. Un modelo parcheado a mitad de camino es carísimo de corregir; el resto del código no lo es.

### Plan de entregas

| # | Entrega | Estado |
|---|---|---|
| 1 | Núcleo de adopción | **Esta especificación** |
| 2 | Casos financieros y transparencia | Pendiente |
| 3 | Postulaciones de adopción | Pendiente |
| 4 | Documentos, auditoría y notificaciones | Pendiente |

---

## 2. Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| Arquitectura | Monolito modular en Next.js | Una sola cosa que mantener; la modularidad que se busca es de código, no de infraestructura |
| Base de datos | PostgreSQL con Prisma | Estándar, portable, sin extensiones exclusivas de proveedor |
| Administración | Panel propio a medida | Único camino que sostiene las reglas de la §11 del sistema de diseño |
| Acceso al panel | Google contra lista de autorizados | Sin contraseñas que perder, sin infraestructura de correo, segundo factor delegado |
| Infraestructura | Sin definir; se diseña portable | Ver §9 |

---

## 3. Arquitectura

### 3.1 Las tres capas

```
app/                    Rutas públicas y /panel. Solo presentación.
domains/                Reglas de negocio. Un módulo por dominio.
infra/                  Prisma, almacenamiento, proveedores. Reemplazables.
```

**Regla que gobierna todo:** las páginas y los componentes **nunca** hablan con la base de datos directamente. Toda lectura y escritura pasa por una función de dominio.

Esta regla existe sobre todo por la entrega 2. Cuando haya dinero en juego, la única forma de mover un peso será llamar a una función del dominio `finanzas`. No habrá manera de escribir un asiento desde un componente, ni siquiera por descuido.

### 3.2 Módulos de dominio

| Módulo | Responsabilidad | Entrega |
|---|---|---|
| `animales` | Alta, edición, estados, fotos, direcciones permanentes | 1 |
| `usuarios` | Autorización, roles | 1 |
| `auditoria` | Registro de acciones administrativas | 1 |
| `adopciones` | Formularios configurables, postulaciones | 3 |
| `finanzas` | Casos, asientos contables, saldos, pagos | 2 |
| `documentos` | Comprobantes, visibilidad, validación | 4 |
| `notificaciones` | Avisos por correo y otros canales | 4 |

Cada módulo expone funciones con nombres del negocio (`publicarAnimal`, `archivarAnimal`, `registrarDonacionVerificada`) y esconde adentro cómo se guardan las cosas. Es donde viven las reglas y a donde apuntan las pruebas.

Un módulo no importa el cliente de Prisma de otro módulo. Si `adopciones` necesita saber de un animal, llama a una función de `animales`.

---

## 4. Modelo de datos

### 4.1 Decisiones que lo definen

**Los importes son enteros en centavos.** Nunca decimales de punto flotante: producen errores de redondeo que después aparecen como diferencias de un peso en el balance público. Cada monto lleva su moneda explícita.

**El libro contable es solo de agregado.** `AsientoContable` no admite modificación ni borrado. Esto se garantiza en la base con un disparador que rechaza `UPDATE` y `DELETE` sobre la tabla, escrito como migración SQL propia: Prisma no puede expresarlo, y dejarlo solo en el código lo vuelve una convención en lugar de una garantía. Una corrección es un asiento nuevo de tipo `AJUSTE` que apunta al original.

**El saldo se calcula y además se guarda.** Se escribe en el caso dentro de la misma transacción que inserta el asiento. Las páginas públicas leen el valor guardado, porque una página viral no puede sumar miles de filas en cada visita.

Una tarea programada diaria compara el valor guardado contra la suma real de los asientos de cada caso. Si difieren, deja el resultado en el registro de auditoría y avisa al rol Administración. Una diferencia significa que alguien tocó la base por fuera del sistema, y eso hay que saberlo el mismo día, no cuando lo note un donante.

**Los webhooks se registran antes de procesarse.** El identificador externo es clave única: si el proveedor manda el mismo aviso dos veces, el segundo choca contra la restricción y no suma nada. La idempotencia la garantiza la base, no una condición en el código.

**Nada se borra.** Los animales se archivan. La dirección permanente nunca cambia; si el nombre se corrige, una tabla de redirecciones mantiene vivo el enlace que circuló por Facebook.

**Los datos personales viven separados.** Las postulaciones son su propia tabla, sin ninguna relación que las acerque a algo que se sirva sin autenticación.

### 4.2 Entidades

**Dominio animales (entrega 1)**

```prisma
model Animal {
  id            String        @id @default(cuid())
  slug          String        @unique   // permanente, nunca cambia
  nombre        String
  especie       Especie
  sexo          Sexo
  tamano        Tamano
  fechaNacimientoAprox DateTime?
  peso          Int?                    // gramos
  descripcion   String
  personalidad  String?
  zona          String?
  transito      String?
  castrado      Boolean       @default(false)
  vacunasAlDia  Boolean       @default(false)
  requisitos    String?
  estado        EstadoAnimal  @default(BORRADOR)
  archivado     Boolean       @default(false)
  publicadoEn   DateTime?
  adoptadoEn    DateTime?
  // compatibilidades: extensible sin migración de esquema
  atributos     Json          @default("{}")
  fotos         FotoAnimal[]
  novedades     Novedad[]
  casos         CasoFinanciero[]
  creadoEn      DateTime      @default(now())
  actualizadoEn DateTime      @updatedAt

  @@index([estado, archivado])
  @@index([especie, tamano, estado])
}

model FotoAnimal {
  id          String   @id @default(cuid())
  animalId    String
  animal      Animal   @relation(fields: [animalId], references: [id])
  claveArchivo String            // clave en el almacén, sin URL completa
  alt         String
  orden       Int
  principal   Boolean  @default(false)
  sensible    Boolean  @default(false)
  ancho       Int
  alto        Int
  placeholder String            // miniatura mínima embebida
  creadoEn    DateTime @default(now())

  @@index([animalId, orden])
}

model RedireccionDireccion {
  slugAnterior String   @id
  animalId     String?
  casoId       String?
  creadoEn     DateTime @default(now())
}

enum EstadoAnimal {
  BORRADOR
  DISPONIBLE
  EN_EVALUACION
  RESERVADO
  ADOPTADO
  TRANSITO
  TRATAMIENTO
  NO_DISPONIBLE
  FALLECIDO
}

enum Especie { PERRO GATO OTRO }
enum Sexo    { MACHO HEMBRA }
enum Tamano  { PEQUENO MEDIANO GRANDE }
```

**Sobre `atributos`:** las compatibilidades y características futuras (bueno con niños, nivel de energía, necesidades especiales) van en un campo JSON con una lista de definiciones en código. La §14 del pedido original exige que los filtros sean fácilmente extensibles; agregar una columna por cada característica obliga a migrar la base cada vez. Los filtros que se usan para ordenar y buscar en volumen —especie, tamaño, estado— sí son columnas con índice.

**Dominio usuarios y auditoría (entrega 1)**

```prisma
model Usuario {
  id        String   @id @default(cuid())
  email     String   @unique     // debe coincidir con el de Google
  nombre    String
  rol       Rol
  activo    Boolean  @default(true)
  ultimoAcceso DateTime?
  creadoEn  DateTime @default(now())
}

enum Rol { ADMINISTRACION ANIMALES FINANZAS REDACCION }

model RegistroAuditoria {
  id          String   @id @default(cuid())
  usuarioId   String?
  usuarioEmail String            // copia: sobrevive al borrado del usuario
  accion      String             // "animal.publicar", "asiento.crear"
  entidad     String
  entidadId   String
  valorAnterior Json?
  valorNuevo  Json?
  ip          String?
  creadoEn    DateTime @default(now())

  @@index([entidad, entidadId])
  @@index([creadoEn])
}
```

**Dominio finanzas (diseñado ahora, se implementa en la entrega 2)**

```prisma
model CasoFinanciero {
  id          String   @id @default(cuid())
  slug        String   @unique
  animalId    String?
  titulo      String
  situacion   String
  metaCentavos BigInt
  moneda      String   @default("ARS")
  estado      EstadoCaso @default(ABIERTO)
  // saldo derivado, escrito solo por el dominio finanzas
  recibidoCentavos BigInt @default(0)
  gastadoCentavos  BigInt @default(0)
  cantidadDonantes Int    @default(0)
  asientos    AsientoContable[]
  creadoEn    DateTime @default(now())
}

model AsientoContable {
  id            String       @id @default(cuid())
  casoId        String
  tipo          TipoAsiento
  centavos      BigInt              // positivo entra, negativo sale
  moneda        String       @default("ARS")
  descripcion   String
  proveedor     String?             // "mercadopago", "transferencia", "manual"
  pagoExternoId String?
  ajustaAId     String?             // el asiento que corrige
  documentoId   String?
  creadoPorId   String?
  creadoPorSistema Boolean   @default(false)
  fechaEfectiva DateTime
  creadoEn      DateTime     @default(now())

  @@index([casoId, fechaEfectiva])
  @@unique([proveedor, pagoExternoId])   // segunda barrera contra duplicados
}

enum TipoAsiento { DONACION GASTO REEMBOLSO TRANSFERENCIA AJUSTE }
enum EstadoCaso  { ABIERTO META_ALCANZADA CERRADO }

model EventoWebhook {
  id           String   @id @default(cuid())
  proveedor    String
  eventoExternoId String
  cargaUtil    Json
  procesadoEn  DateTime?
  resultado    String?
  recibidoEn   DateTime @default(now())

  @@unique([proveedor, eventoExternoId])  // la idempotencia vive acá
}
```

**Regla de escritura:** `recibidoCentavos` y `gastadoCentavos` solo los escribe el dominio `finanzas`, dentro de la transacción que inserta el asiento. Ninguna otra ruta de código los toca. El panel los muestra bloqueados con candado, según la §11 del sistema de diseño.

**Dominio adopciones y documentos (entregas 3 y 4)**

`FormularioAdopcion`, `PreguntaFormulario` (con tipo de respuesta, orden y obligatoriedad), `Postulacion`, `RespuestaPostulacion`, `Documento` (con visibilidad pública o privada y confirmación de datos tachados), `Novedad`.

---

## 5. Imágenes

Es donde una plataforma gratuita se rompe o sobrevive: las fotos son casi todo el peso del sitio.

**Al subir:** el servidor convierte a formatos modernos, genera varias medidas y produce una miniatura mínima embebida que reserva el espacio mientras carga, para que la página no salte. **El original no se sirve nunca.**

**Validación:** el tipo se determina por el contenido real del archivo, no por la extensión ni por lo que declare el navegador. Límite de tamaño explícito. Es la defensa contra un ejecutable disfrazado de foto.

**Imágenes sensibles:** hasta que la persona la abre, solo se descarga la versión chica y difuminada. Protege y además ahorra datos móviles.

**Almacenamiento:** detrás de una interfaz `AlmacenDeArchivos` con implementación local para desarrollo y S3-compatible en producción. La base guarda la clave del archivo, nunca la URL completa: cambiar de proveedor no obliga a reescribir filas.

**Imagen de vista previa social:** se genera por ruta a partir de la foto principal y el nombre, y se cachea.

---

## 6. Renderizado y SEO

Las páginas públicas se generan estáticamente y **se regeneran cuando la asociación publica un cambio**, con invalidación por etiqueta; no con un temporizador. Un caso viral en Facebook se sirve como archivo estático y aguanta el pico sin tocar la base.

Esto resuelve solo el problema del plan gratuito: si la base se suspendió por inactividad, el visitante no se entera porque su página ya existe. La espera de arranque la sufre únicamente quien entra al panel.

Cada animal lleva título propio, descripción, dirección canónica, metadatos de Open Graph, datos estructurados y su imagen de vista previa. Mapa del sitio generado desde la base. El panel queda excluido de los buscadores y sin caché.

Presupuesto de rendimiento: la primera pantalla de una ficha no supera los 150 KB sin contar la foto principal.

---

## 7. Acceso, roles y auditoría

**Autenticación:** Google, contra la lista de correos de la tabla `Usuario`. No hay registro público: alguien tiene que dar de alta a cada persona. Un correo que no está en la tabla no entra, aunque su cuenta de Google sea válida.

**Autorización:** se verifica **en la capa de dominio**, no en la pantalla. Esconder un botón no es seguridad. Si el rol de redacción llama a la función de registrar un gasto, la función lo rechaza aunque la interfaz nunca haya mostrado ese botón.

| Rol | Animales | Postulaciones | Dinero |
|---|---|---|---|
| Administración | Todo | Todo | Todo |
| Animales | Todo | Todo | Solo lectura |
| Finanzas | Solo lectura | Sin acceso | Todo |
| Redacción | Novedades | Sin acceso | Solo lectura |

**Auditoría:** el registro se escribe en la misma transacción que la acción. O quedan las dos, o no queda ninguna. Nunca una acción sin su rastro.

---

## 8. Pruebas

Las pruebas se concentran en las funciones de dominio, que es donde viven las reglas, y se escriben antes que el código.

Además de los casos normales, un grupo específico verifica **lo que no se puede hacer**:

- No existe forma de escribir un saldo a mano desde fuera del dominio `finanzas`.
- Un asiento contable no se puede modificar ni borrar.
- La dirección de un animal no cambia al editarlo, y si el nombre cambia, la dirección vieja sigue resolviendo.
- Un rol sin permiso recibe un rechazo aunque llame directo a la función.
- Un archivo que no es imagen se rechaza aunque tenga extensión de imagen.

Esas son las pruebas que protegen la promesa de la plataforma. Si alguna se cae, alguien abrió una puerta que no debía existir.

Cada página pública tiene además una prueba de humo que verifica que responde y trae sus metadatos.

---

## 9. Despliegue y portabilidad

La infraestructura no está definida, así que el diseño no se ata a ningún proveedor:

- PostgreSQL estándar, sin extensiones exclusivas.
- Archivos detrás de la interfaz `AlmacenDeArchivos`.
- Toda configuración por variables de entorno.
- Nada de funciones específicas de una plataforma en la capa de dominio.

**Copias de seguridad:** exportación periódica de la base y del almacén de archivos a un destino independiente. Los planes gratuitos no garantizan recuperación ante un borrado accidental.

**Qué cambia si mañana hay presupuesto:**

| Con plan gratuito | Con presupuesto |
|---|---|
| La base se suspende por inactividad; el panel tarda en abrir la primera vez | Base siempre activa |
| Tope de tráfico y de ancho de banda | Sin tope práctico |
| Copias de seguridad manuales o por tarea programada | Copias automáticas del proveedor |
| Límite de espacio para fotos | Galerías sin restricción |

Ninguno de esos cambios exige tocar el código de dominio.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| La disciplina de módulos se afloja y aparece lógica de negocio en los componentes | Regla explícita en §3.1, verificada en revisión de código; las pruebas apuntan al dominio, lo que lo hace incómodo de saltear |
| El plan gratuito se queda corto por volumen de fotos | Pipeline agresivo de compresión desde el día uno; §9 documenta la salida |
| La asociación necesita las postulaciones antes de la entrega 3 | El modelo ya está diseñado; se puede adelantar la entrega sin migración |
| Pérdida de datos por borrado accidental en plan gratuito | Copias de seguridad periódicas a destino independiente |

---

## 11. Siguiente paso

Plan de implementación de esta entrega, mediante la skill `writing-plans`.
