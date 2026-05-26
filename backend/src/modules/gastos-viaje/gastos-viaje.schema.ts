import { z } from 'zod';

const idSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String);

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe tener formato YYYY-MM-DD');

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

const gastoViajeBaseSchema = z.object({
  tipo_gasto_id: idSchema,
  descripcion: optionalTrimmedString(255),
  monto: z.coerce.number().positive(),
  fecha_gasto: dateOnlySchema.optional().nullable(),
  es_estimado: z.boolean().optional()
});

export const gastoViajeCreateSchema = gastoViajeBaseSchema;

export const gastoViajeUpdateSchema = gastoViajeBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export type GastoViajeCreateInput = z.infer<typeof gastoViajeCreateSchema>;
export type GastoViajeUpdateInput = z.infer<typeof gastoViajeUpdateSchema>;
