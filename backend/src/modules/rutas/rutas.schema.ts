import { z } from 'zod';

export const sentidoPeajeValues = ['ida', 'retorno', 'ambos'] as const;

const idSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String);

const rutaPeajeNestedSchema = z.object({
  peaje_id: idSchema,
  orden: z.coerce.number().int().positive().optional().nullable(),
  sentido: z.enum(sentidoPeajeValues).optional()
});

export const rutaCreateSchema = z.object({
  origen: z.string().trim().min(1).max(120),
  destino: z.string().trim().min(1).max(120),
  distancia_km: z.coerce.number().min(0).optional(),
  duracion_estimada_horas: z.coerce.number().min(0).optional().nullable(),
  activa: z.boolean().optional(),
  global: z.boolean().optional(),
  peajes: z.array(rutaPeajeNestedSchema).optional()
});

export const rutaUpdateSchema = rutaCreateSchema
  .omit({ global: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export const rutaEstadoSchema = z.object({
  activa: z.boolean()
});

export type RutaCreateInput = z.infer<typeof rutaCreateSchema>;
export type RutaUpdateInput = z.infer<typeof rutaUpdateSchema>;
export type RutaEstadoInput = z.infer<typeof rutaEstadoSchema>;
