import { z } from 'zod';

const idSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String);

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe tener formato YYYY-MM-DD');

const tarifaPeajeBaseSchema = z.object({
  peaje_id: idSchema,
  categoria_peaje_id: idSchema,
  valor: z.coerce.number().min(0),
  vigente_desde: dateOnlySchema.optional(),
  vigente_hasta: dateOnlySchema.optional().nullable(),
  activa: z.boolean().optional()
});

export const tarifaPeajeCreateSchema = tarifaPeajeBaseSchema
  .extend({
    global: z.boolean().optional()
  })
  .refine(
    (value) =>
      !value.vigente_desde ||
      !value.vigente_hasta ||
      value.vigente_hasta >= value.vigente_desde,
    {
      message: 'vigente_hasta debe ser mayor o igual a vigente_desde'
    }
  );

export const tarifaPeajeUpdateSchema = tarifaPeajeBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  })
  .refine(
    (value) =>
      !value.vigente_desde ||
      !value.vigente_hasta ||
      value.vigente_hasta >= value.vigente_desde,
    {
      message: 'vigente_hasta debe ser mayor o igual a vigente_desde'
    }
  );

export const tarifaPeajeEstadoSchema = z.object({
  activa: z.boolean()
});

export type TarifaPeajeCreateInput = z.infer<typeof tarifaPeajeCreateSchema>;
export type TarifaPeajeUpdateInput = z.infer<typeof tarifaPeajeUpdateSchema>;
export type TarifaPeajeEstadoInput = z.infer<typeof tarifaPeajeEstadoSchema>;
