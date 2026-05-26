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
    .transform((value) => value || undefined);

const booleanQuerySchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;

  return value;
}, z.boolean().optional());

export const reporteMantenimientosFiltersSchema = z
  .object({
    fecha_desde: dateOnlySchema.optional(),
    fecha_hasta: dateOnlySchema.optional(),
    placa: optionalTrimmedString(20),
    palabra_clave: optionalTrimmedString(120),
    search: optionalTrimmedString(120),
    por_vencer: booleanQuerySchema,
    vehiculo_id: idSchema.optional(),
    tipo_mantenimiento_id: idSchema.optional(),
    estado: z.enum(['programado', 'realizado', 'cancelado', 'vencido']).optional(),
    dias_anticipacion_fecha: z.coerce.number().int().min(0).max(365).optional().default(30)
  })
  .refine(
    (value) =>
      !value.fecha_desde || !value.fecha_hasta || value.fecha_hasta >= value.fecha_desde,
    {
      message: 'fecha_hasta debe ser mayor o igual a fecha_desde'
    }
  );

export type ReporteMantenimientosFilters = z.infer<typeof reporteMantenimientosFiltersSchema>;
