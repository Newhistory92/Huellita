import { z } from "zod";

export const esquemaAnimal = z.object({
  nombre: z.string().trim().min(1, "El animal necesita un nombre").max(60),
  especie: z.enum(["PERRO", "GATO", "OTRO"]),
  sexo: z.enum(["MACHO", "HEMBRA"]),
  tamano: z.enum(["PEQUENO", "MEDIANO", "GRANDE"]),
  descripcion: z.string().trim().min(20, "La descripción tiene que contar su historia"),
  personalidad: z.string().trim().optional(),
  zona: z.string().trim().optional(),
  requisitos: z.string().trim().optional(),
  atributos: z.record(z.string(), z.unknown()).default({}),
});

export type EntradaAnimal = z.input<typeof esquemaAnimal>;
