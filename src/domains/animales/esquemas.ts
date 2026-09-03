import { z } from "zod";

export const esquemaAnimal = z.object({
  nombre: z.string().trim().min(1, "El animal necesita un nombre").max(60),
  especie: z.enum(["PERRO", "GATO", "OTRO"]),
  sexo: z.enum(["MACHO", "HEMBRA"]),
  tamano: z.enum(["PEQUENO", "MEDIANO", "GRANDE"]),
  descripcion: z.string().trim().min(20, "La descripción tiene que contar su historia"),
  // Prisma devuelve null en las columnas opcionales sin valor, no undefined.
  personalidad: z.string().trim().nullable().optional().transform((v) => v ?? undefined),
  zona: z.string().trim().nullable().optional().transform((v) => v ?? undefined),
  requisitos: z.string().trim().nullable().optional().transform((v) => v ?? undefined),
  castrado: z.boolean().default(false),
  vacunasAlDia: z.boolean().default(false),
  atributos: z.record(z.string(), z.unknown()).default({}),
});

export type EntradaAnimal = z.input<typeof esquemaAnimal>;
