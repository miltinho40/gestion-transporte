import { z } from 'zod';

export const mantenimientoEstadoValues = [
  'programado',
  'realizado',
  'cancelado',
  'vencido'
] as const;

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

const repuestoMantenimientoSchema = z.object({
  nombre_repuesto: z.string().trim().min(1).max(150),
  cantidad: z.coerce.number().positive().optional(),
  costo_unitario: z.coerce.number().min(0)
});

const mantenimientoBaseSchema = z.object({
  vehiculo_id: idSchema,
  tipo_mantenimiento_id: idSchema,
  fecha_mantenimiento: dateOnlySchema.optional(),
  kilometraje_actual_vehiculo: z.coerce.number().int().min(0).optional(),
  descripcion: optionalTrimmedString(1000),
  costo_mano_obra: z.coerce.number().min(0).optional(),
  costo_repuestos: z.coerce.number().min(0).optional(),
  proximo_mantenimiento_km: z.coerce.number().int().min(0).optional().nullable(),
  proximo_mantenimiento_fecha: dateOnlySchema.optional().nullable(),
  estado: z.enum(mantenimientoEstadoValues).optional(),
  actualizar_kilometraje_vehiculo: z.boolean().optional(),
  repuestos: z.array(repuestoMantenimientoSchema).optional()
});

export const mantenimientoCreateSchema = mantenimientoBaseSchema;

export const mantenimientoUpdateSchema = mantenimientoBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export const mantenimientoEstadoSchema = z.object({
  estado: z.enum(mantenimientoEstadoValues)
});

export type MantenimientoCreateInput = z.infer<typeof mantenimientoCreateSchema>;
export type MantenimientoUpdateInput = z.infer<typeof mantenimientoUpdateSchema>;
export type MantenimientoEstadoInput = z.infer<typeof mantenimientoEstadoSchema>;
export type MantenimientoEstadoApi = (typeof mantenimientoEstadoValues)[number];
