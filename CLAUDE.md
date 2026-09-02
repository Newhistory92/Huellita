# Huellas — Plataforma de la Asociación Civil

## Idioma

**Escribí siempre en castellano rioplatense.** Sin excepción, en todo:

- Las respuestas y explicaciones en el chat.
- Las preguntas que me hagas: si necesitás que decida algo, preguntámelo en castellano.
- Los mensajes de commit.
- Los nombres de funciones, variables, tipos y archivos del código.
- Los comentarios del código.
- Los textos que ve el usuario en la pantalla.
- Los mensajes de error, tanto los del sistema como los que ve la gente.

Solo quedan en inglés las palabras que son parte de una herramienta y no tienen traducción real: los nombres de las bibliotecas, las palabras clave del lenguaje, los comandos de git y las claves de configuración.

No uses voseo en la interfaz salvo donde el prototipo aprobado ya lo usa.

## Qué es este proyecto

Plataforma web donada a una asociación de rescate animal. Reemplaza a Facebook como fuente permanente de información: adopciones con ficha que no caduca, casos financieros con libro contable verificable, y transparencia de en qué se gastó cada peso donado.

El principio que ordena todo: **Facebook trae a la gente, la plataforma organiza la información, el libro contable explica dónde fue la plata, y la dirección permanente conserva la historia.**

## Documentos que mandan

Leelos antes de escribir código. Si algo del código contradice a estos documentos, mandan los documentos.

| Documento | Qué define |
|---|---|
| `docs/specs/2026-09-02-sistema-diseno-v1.md` | Sistema de diseño aprobado: colores, tipografía, componentes, accesibilidad |
| `docs/specs/2026-09-02-entrega-1-nucleo-adopcion-design.md` | Especificación técnica de la entrega 1 |
| `docs/plans/2026-09-02-entrega-1-nucleo-adopcion.md` | Plan de implementación, tarea por tarea |
| `docs/prototipo/huellas-prototipo-v1.html` | Prototipo aprobado: los valores visuales se copian de acá, no se reinventan |

## Reglas que no se negocian

Salen de las especificaciones. Romper cualquiera de estas es romper la promesa del producto:

1. **Las páginas y los componentes nunca acceden a la base de datos directamente.** Toda lectura y escritura pasa por una función de dominio.
2. **Los importes son enteros en centavos (`BigInt`), nunca decimales de punto flotante.**
3. **El libro contable es solo de agregado.** Un asiento no se modifica ni se borra: una corrección es un asiento nuevo de tipo ajuste.
4. **Nada se borra.** Los animales se archivan; la dirección permanente nunca cambia.
5. **Los permisos se verifican en la capa de dominio, no escondiendo botones.**
6. **La auditoría se escribe en la misma transacción que la acción.**
7. **El naranja es solo para el dinero.** El resto de la interfaz usa el verde de marca.
8. **Ninguna imagen sensible se muestra sin que la persona decida abrirla.**
9. **Ningún comprobante publicado muestra datos personales de nadie.**

## Cómo trabajar

- Primero la prueba, después el código. Correr la prueba y verla fallar antes de implementar.
- Un commit por tarea del plan, con el mensaje que el plan indica.
- Si algo del plan no coincide con la realidad del código o resulta imposible como está escrito, frená y decímelo antes de improvisar otra solución.
- No commitees `.claude/settings.local.json` ni `.env`: tienen configuración local.

## Comandos

```bash
npm run dev        # servidor de desarrollo
npm test           # todas las pruebas
npm run test:invariantes   # solo las que protegen las reglas de arriba
npx prisma migrate dev     # aplicar migraciones
```
