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

## Qué cambia si mañana hay presupuesto

| Con plan gratuito | Con presupuesto |
|---|---|
| La base se suspende por inactividad; el panel tarda en abrir la primera vez | Base siempre activa |
| Tope de tráfico y de ancho de banda | Sin tope práctico |
| Copias de seguridad manuales o por tarea programada | Copias automáticas del proveedor |
| Límite de espacio para fotos | Galerías sin restricción |

Ninguno de esos cambios exige tocar el código de dominio: la infraestructura no está atada a ningún proveedor (`docs/specs/2026-09-02-entrega-1-nucleo-adopcion-design.md`, §9).
