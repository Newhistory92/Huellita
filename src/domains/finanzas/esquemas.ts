import { z } from "zod";

export const esquemaCaso = z.object({
  titulo: z.string().trim().min(1, "El caso necesita un título").max(120),
  situacion: z.string().trim().min(20, "Contá qué le pasó al animal: es lo primero que lee quien llega desde Facebook"),
  metaCentavos: z.bigint().positive("La meta tiene que ser mayor que cero"),
  animalId: z.string().nullable().default(null),
  moneda: z.string().default("ARS"),
});

export const esquemaGasto = z.object({
  casoId: z.string().min(1),
  centavos: z.bigint().positive("El importe del gasto tiene que ser mayor que cero"),
  descripcion: z.string().trim().min(3, "Describí en qué se gastó"),
  documentoId: z.string().nullable().default(null),
  fechaEfectiva: z.date(),
});

export const esquemaAjuste = z.object({
  casoId: z.string().min(1),
  centavos: z.bigint(),
  ajustaAId: z.string().min(1, "Un ajuste tiene que apuntar al asiento que corrige"),
  motivo: z.string().trim().min(10, "El motivo del ajuste queda publicado: escribí por qué se corrige"),
  documentoId: z.string().min(1, "Un ajuste necesita documentación de respaldo"),
});

export type EntradaCaso = z.input<typeof esquemaCaso>;
export type EntradaGasto = z.input<typeof esquemaGasto>;
export type EntradaAjuste = z.input<typeof esquemaAjuste>;
