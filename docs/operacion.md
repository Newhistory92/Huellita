# Operación

Guía para quien administre la plataforma día a día: no es documentación de código, es documentación de tareas.

## Dar de alta a una persona en el panel

No hay registro público ni pantalla de gestión de personas usuarias en esta entrega: el acceso se controla desde la tabla `Usuario` de la base de datos. Si el correo con el que alguien intenta entrar con Google no está ahí, activo, con un rol asignado, no entra (`src/infra/auth.ts`).

**Primera persona administradora**, al desplegar por primera vez:

1. Definir la variable de entorno `EMAIL_ADMINISTRACION` con su correo de Google.
2. Correr `npx tsx prisma/seed.ts`. Deja a esa persona con rol `ADMINISTRACION` y activa.

**Cualquier otra persona**, o para cambiar el rol de alguien que ya tiene acceso:

1. Abrir `npm run db:studio` (Prisma Studio) contra la base correspondiente.
2. En la tabla `Usuario`, crear o editar el registro: `email` (el mismo con el que va a entrar por Google), `nombre`, `rol` (`ADMINISTRACION`, `ANIMALES`, `FINANZAS` o `REDACCION`), `activo: true`.

Para retirarle el acceso a alguien, no se borra el registro: se pone `activo: false`. La fila queda como historial de que esa persona tuvo acceso.

## Copia de seguridad

**Base de datos:** exportación periódica con `pg_dump` a un destino independiente del proveedor de la base (otro almacenamiento, no otra base del mismo proveedor):

```bash
pg_dump "$DATABASE_URL" --format=custom --file="huellas-$(date +%Y-%m-%d).dump"
```

Para restaurar: `pg_restore --dbname="$DATABASE_URL" huellas-2026-09-02.dump`.

**Almacén de archivos:** el directorio completo apuntado por `ALMACEN_DIRECTORIO_LOCAL` (o el equivalente del proveedor, si ya se migró a uno S3-compatible). Copiarlo entero, no solo las fotos: ahí también quedan las variantes procesadas.

```bash
tar -czf "almacen-$(date +%Y-%m-%d).tar.gz" -C "$ALMACEN_DIRECTORIO_LOCAL" .
```

Programar ambas copias con la misma periodicidad y guardarlas juntas: una base sin sus fotos, o fotos sin la base que las referencia, no sirve para recuperar nada.

## Almacenamiento de las fotos

En desarrollo las fotos se guardan en la carpeta `almacenamiento/`. **En producción eso no sirve:** los servidores sin estado borran el disco en cada despliegue, así que las fotos desaparecerían sin ningún mensaje de error. La aplicación se niega a subir fotos en producción si no hay un almacén configurado.

### Por qué Cloudflare R2

La aplicación habla el protocolo S3, así que funciona con R2, Supabase Storage, MinIO o el propio S3. Para esta asociación conviene **Cloudflare R2** por una razón concreta: **no cobra el tráfico de salida**.

Ese es el costo que importa acá. Cuando un caso se comparte en Facebook y lo abren diez mil personas, cada visita descarga fotos. En S3 eso se factura por gigabyte; en R2 es gratis. El plan gratuito de R2 incluye 10 GB de almacenamiento, que a razón de unas cuatro medidas por foto alcanza para varios miles de animales.

### Configuración, paso a paso

1. Crear una cuenta en Cloudflare y entrar a **R2**.
2. **Create bucket**, nombre `huellas-fotos`. Región automática.
3. En el bucket, **Settings → Public access**: habilitar el acceso público. R2 da una dirección del estilo `https://pub-xxxxx.r2.dev`. Para producción conviene conectar un subdominio propio, por ejemplo `fotos.refugiohuellas.org.ar`.
4. En **R2 → Manage API Tokens**, crear un token con permiso de **Object Read & Write** sobre ese bucket. Anotar la clave y el secreto: el secreto se muestra una sola vez.
5. Completar las variables de entorno:

```
ALMACEN_S3_ENDPOINT="https://<id-de-cuenta>.r2.cloudflarestorage.com"
ALMACEN_S3_BUCKET="huellas-fotos"
ALMACEN_S3_CLAVE="<la clave del token>"
ALMACEN_S3_SECRETO="<el secreto del token>"
NEXT_PUBLIC_ALMACEN_URL="https://fotos.refugiohuellas.org.ar"
```

Las cuatro primeras van juntas: con una sola que falte, la aplicación considera que no hay almacén configurado y avisa cuáles faltan. Es deliberado — una configuración a medias es peor que ninguna, porque parece funcionar.

`NEXT_PUBLIC_ALMACEN_URL` es aparte: define desde dónde las ve el público. Si queda vacía, las fotos se sirven a través de la propia aplicación, que funciona pero paga el tráfico.

### Mudar las fotos que ya están

Si ya se cargaron animales con el almacén local, hay que copiar el contenido de `almacenamiento/` al bucket conservando la estructura de carpetas. La base guarda la clave del archivo, nunca la dirección completa, así que no hace falta tocar ningún dato.

## Avisos por correo

Cuando pasa algo que alguien del equipo tiene que ver sin estar mirando el panel —una donación se verificó, una postulación llegó, una transferencia quedó pendiente, un caso alcanzó la meta—, la aplicación anota un aviso en una cola. Un proceso aparte vacía esa cola y manda los correos. Mientras no haya cuenta de Resend configurada, los correos no se pierden: se escriben en la consola del servidor, que es el comportamiento correcto para desarrollo.

### Crear la cuenta y verificar el dominio

1. Crear una cuenta en [resend.com](https://resend.com).
2. En **Domains → Add Domain**, agregar el dominio propio (por ejemplo `refugiohuellas.org.ar`) y cargar los registros DNS (SPF, DKIM) que Resend indica en el proveedor donde esté delegado el dominio.
3. Esperar a que el dominio quede en estado **Verified**. Sin el dominio verificado, Resend solo deja mandar correos a la dirección con la que se creó la cuenta: sirve para probar, no para producción.
4. En **API Keys**, crear una clave con permiso de envío.
5. Completar las variables de entorno:

```
RESEND_API_KEY="<la clave creada>"
CORREO_REMITENTE="Huellas <avisos@refugiohuellas.org.ar>"
```

`CORREO_REMITENTE` tiene que usar el dominio ya verificado: con un dominio distinto, Resend rechaza el envío.

### Programar el vaciado de la cola

Anotar el aviso no manda el correo: eso lo hace `POST /api/tareas/avisos`, protegida con un secreto propio para que no la dispare cualquiera.

1. Generar un secreto y completar `TAREAS_SECRETO` en las variables de entorno.
2. Programar una tarea periódica (cron del proveedor de hosting, GitHub Actions con `schedule`, o cualquier programador de tareas) que llame a la ruta cada pocos minutos:

```bash
curl -X POST "https://<dominio-de-la-app>/api/tareas/avisos" \
  -H "x-tareas-secreto: <el mismo valor de TAREAS_SECRETO>"
```

Sin esta tarea programada, los avisos se siguen anotando en la cola pero nadie los recibe por correo: se van acumulando hasta que algo llame a la ruta.

También se puede vaciar la cola a mano desde el servidor, útil para verificar que la configuración quedó bien: `npm run avisos`.

## Qué cambia si mañana hay presupuesto

| Con plan gratuito | Con presupuesto |
|---|---|
| La base se suspende por inactividad; el panel tarda en abrir la primera vez | Base siempre activa |
| Tope de tráfico y de ancho de banda | Sin tope práctico |
| Copias de seguridad manuales o por tarea programada | Copias automáticas del proveedor |
| Límite de espacio para fotos | Galerías sin restricción |

Ninguno de esos cambios exige tocar el código de dominio: la infraestructura no está atada a ningún proveedor (`docs/specs/2026-09-02-entrega-1-nucleo-adopcion-design.md`, §9).
