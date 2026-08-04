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

const listFromQuery = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
};

const idListSchema = z.preprocess(listFromQuery, z.array(idSchema).optional());

const monthListSchema = z.preprocess(
  listFromQuery,
  z.array(z.coerce.number().int().min(1).max(12)).min(1, 'Selecciona al menos un mes').optional()
);

const weekListSchema = z.preprocess(
  listFromQuery,
  z.array(z.coerce.number().int().min(1).max(53)).optional()
);

export const reporteViajesFiltersSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  meses: monthListSchema,
  semanas: weekListSchema,
  vehiculo_ids: idListSchema,
  cliente_ids: idListSchema,
  cobrado: booleanQuerySchema,
  search: optionalTrimmedString(120)
});

export const reporteUtilidadFiltersSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  vehiculo_id: idSchema.optional()
});

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

export type ReporteViajesFilters = z.infer<typeof reporteViajesFiltersSchema>;
export type ReporteUtilidadFilters = z.infer<typeof reporteUtilidadFiltersSchema>;
export type ReporteMantenimientosFilters = z.infer<typeof reporteMantenimientosFiltersSchema>;
