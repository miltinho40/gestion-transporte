import { z } from 'zod';

const idSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String);

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe tener formato YYYY-MM-DD');

const tarifaPeajeNestedSchema = z
  .object({
    categoria_peaje_id: idSchema,
    valor: z.coerce.number().min(0),
    vigente_desde: dateOnlySchema.optional(),
    vigente_hasta: dateOnlySchema.optional().nullable(),
    activa: z.boolean().optional()
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

export const peajeCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  ubicacion: z.string().trim().max(180).optional().nullable().transform((value) => value || null),
  activo: z.boolean().optional(),
  global: z.boolean().optional(),
  tarifas: z.array(tarifaPeajeNestedSchema).optional()
});

export const peajeUpdateSchema = peajeCreateSchema
  .omit({ global: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export const peajeEstadoSchema = z.object({
  activo: z.boolean()
});

export type PeajeCreateInput = z.infer<typeof peajeCreateSchema>;
export type PeajeUpdateInput = z.infer<typeof peajeUpdateSchema>;
export type PeajeEstadoInput = z.infer<typeof peajeEstadoSchema>;
