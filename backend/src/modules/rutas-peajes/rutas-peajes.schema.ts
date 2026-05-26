import { z } from 'zod';

export const sentidoPeajeValues = ['ida', 'retorno', 'ambos'] as const;

const idSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String);

export const rutaPeajeCreateSchema = z.object({
  ruta_id: idSchema,
  peaje_id: idSchema,
  orden: z.coerce.number().int().positive().optional().nullable(),
  sentido: z.enum(sentidoPeajeValues).optional(),
  global: z.boolean().optional()
});

export const rutaPeajeUpdateSchema = rutaPeajeCreateSchema
  .omit({ global: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export type RutaPeajeCreateInput = z.infer<typeof rutaPeajeCreateSchema>;
export type RutaPeajeUpdateInput = z.infer<typeof rutaPeajeUpdateSchema>;
export type SentidoPeajeApi = (typeof sentidoPeajeValues)[number];
