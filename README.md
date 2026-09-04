# Huellas

Plataforma web donada a la Asociación Civil Huellas: reemplazo permanente de Facebook como fuente de información de adopciones, casos financieros y transparencia de donaciones.

## Instalación

```bash
npm install
cp .env.example .env   # completar con los valores propios
npx prisma migrate dev
npm run dev
```

## Variables de entorno

Ver `.env.example`. Resumen:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `DATABASE_URL_TEST` | Base separada para las pruebas de integración (nunca la misma que `DATABASE_URL`) |
| `AUTH_SECRET` | Firma de sesión de NextAuth. Generar con `npx auth secret` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Credenciales OAuth de Google |
| `ALMACEN_DIRECTORIO_LOCAL` | Carpeta donde se guardan las fotos en desarrollo |
| `NEXT_PUBLIC_URL_BASE` | Dirección pública del sitio, para SEO y Open Graph |
| `EMAIL_ADMINISTRACION` | Correo de la primera persona administradora, usado por `prisma/seed.ts` |

## Pruebas

```bash
npm test                   # toda la suite
npm run test:invariantes   # solo las que protegen las reglas que no se negocian
```

Las pruebas de integración (carpeta `tests/integracion`) necesitan `DATABASE_URL_TEST` apuntando a una base real.

## Documentación

- [Sistema de diseño](docs/specs/2026-09-02-sistema-diseno-v1.md): colores, tipografía, componentes, accesibilidad.
- [Especificación técnica de la entrega 1](docs/specs/2026-09-02-entrega-1-nucleo-adopcion-design.md): arquitectura, modelo de datos, dominio.
- [Plan de implementación](docs/plans/2026-09-02-entrega-1-nucleo-adopcion.md): tarea por tarea.
- [Operación](docs/operacion.md): alta de personas en el panel, copias de seguridad, qué cambia con presupuesto.
