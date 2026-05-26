import { z } from 'zod';

export const tipoGastoSemanalValues = [
  'bonificacion_conductor',
  'sueldo_conductor',
  'varios',
  'otro'
] as const;

const idSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String);

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

export const cierreSemanalSemanaSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  numero_semana: z.coerce.number().int().min(1).max(53)
});

export const cierreSemanalGenerarGastosSchema = cierreSemanalSemanaSchema
  .extend({
    generar_sueldos: z.boolean().optional().default(true),
    generar_bonificaciones: z.boolean().optional().default(true)
  })
  .refine((value) => value.generar_sueldos || value.generar_bonificaciones, {
    message: 'Debe generar sueldos, bonificaciones o ambos'
  });

export const gastoSemanalFiltersSchema = cierreSemanalSemanaSchema.partial().extend({
  vehiculo_id: idSchema.optional(),
  conductor_id: idSchema.optional(),
  tipo: z.enum(tipoGastoSemanalValues).optional()
});

export const gastoSemanalCreateSchema = cierreSemanalSemanaSchema.extend({
  vehiculo_id: idSchema,
  conductor_id: idSchema.optional().nullable(),
  tipo: z.enum(tipoGastoSemanalValues).optional(),
  descripcion: optionalTrimmedString(255),
  monto: z.coerce.number().min(0),
  es_generado: z.boolean().optional()
});

export const gastoSemanalUpdateSchema = z
  .object({
    vehiculo_id: idSchema.optional(),
    conductor_id: idSchema.optional().nullable(),
    anio: z.coerce.number().int().min(2000).max(2100).optional(),
    numero_semana: z.coerce.number().int().min(1).max(53).optional(),
    tipo: z.enum(tipoGastoSemanalValues).optional(),
    descripcion: optionalTrimmedString(255),
    monto: z.coerce.number().min(0).optional(),
    es_generado: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export type CierreSemanalSemanaInput = z.infer<typeof cierreSemanalSemanaSchema>;
export type CierreSemanalGenerarGastosInput = z.infer<
  typeof cierreSemanalGenerarGastosSchema
>;
export type GastoSemanalFiltersInput = z.infer<typeof gastoSemanalFiltersSchema>;
export type GastoSemanalCreateInput = z.infer<typeof gastoSemanalCreateSchema>;
export type GastoSemanalUpdateInput = z.infer<typeof gastoSemanalUpdateSchema>;
export type TipoGastoSemanalApi = (typeof tipoGastoSemanalValues)[number];
