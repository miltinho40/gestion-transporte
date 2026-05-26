import { z } from 'zod';

const idSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String);

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe tener formato YYYY-MM-DD');

const tarifaRutaBaseSchema = z.object({
  ruta_id: idSchema,
  tipo_carga_id: idSchema,
  capacidad: z.coerce.number().int().positive().optional().nullable(),
  toneladas: z.coerce.number().positive().optional().nullable(),
  precio: z.coerce.number().positive(),
  vigente_desde: dateOnlySchema.optional(),
  vigente_hasta: dateOnlySchema.optional().nullable(),
  activa: z.boolean().optional()
});

export const tarifaRutaCreateSchema = tarifaRutaBaseSchema.refine(
  (value) =>
    !value.vigente_desde ||
    !value.vigente_hasta ||
    value.vigente_hasta >= value.vigente_desde,
  {
    message: 'vigente_hasta debe ser mayor o igual a vigente_desde'
  }
);

export const tarifaRutaUpdateSchema = tarifaRutaBaseSchema
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

export const tarifaRutaEstadoSchema = z.object({
  activa: z.boolean()
});

export type TarifaRutaCreateInput = z.infer<typeof tarifaRutaCreateSchema>;
export type TarifaRutaUpdateInput = z.infer<typeof tarifaRutaUpdateSchema>;
export type TarifaRutaEstadoInput = z.infer<typeof tarifaRutaEstadoSchema>;
