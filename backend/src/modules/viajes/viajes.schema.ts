import { z } from 'zod';

export const viajeEstadoValues = ['programado', 'en_curso', 'completado', 'cancelado'] as const;

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

const guiaRemisionSchema = z
  .array(z.string().trim().min(1).max(80))
  .optional()
  .transform((value) => value ?? []);

const viajeBaseSchema = z.object({
  cliente_id: idSchema,
  vehiculo_id: idSchema,
  conductor_id: idSchema,
  tarifa_ruta_id: idSchema,
  fecha_salida: dateOnlySchema.optional(),
  fecha_llegada: dateOnlySchema.optional().nullable(),
  descripcion_carga: optionalTrimmedString(1000),
  peso_carga_kg: z.coerce.number().min(0).optional().nullable(),
  numeros_guia_remision: guiaRemisionSchema,
  precio_flete: z.coerce.number().positive().optional(),
  precio_real_flete: z.coerce.number().min(0).optional(),
  galones_diesel: z.coerce.number().min(0).optional(),
  costo_diesel: z.coerce.number().min(0).optional(),
  costo_peajes: z.coerce.number().min(0).optional(),
  costo_estimado_gastos: z.coerce.number().min(0).optional(),
  costo_real_gastos: z.coerce.number().min(0).optional().nullable(),
  cobrado: z.boolean().optional(),
  fecha_cobro: dateOnlySchema.optional().nullable(),
  estado: z.enum(viajeEstadoValues).optional(),
  observaciones: optionalTrimmedString(1000)
});

export const viajeCreateSchema = viajeBaseSchema.refine(
  (value) =>
    !value.fecha_salida ||
    !value.fecha_llegada ||
    value.fecha_llegada >= value.fecha_salida,
  {
    message: 'fecha_llegada debe ser mayor o igual a fecha_salida'
  }
);

export const viajeUpdateSchema = viajeBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  })
  .refine(
    (value) =>
      !value.fecha_salida ||
      !value.fecha_llegada ||
      value.fecha_llegada >= value.fecha_salida,
    {
      message: 'fecha_llegada debe ser mayor o igual a fecha_salida'
    }
  );

export const viajeEstadoSchema = z.object({
  estado: z.enum(viajeEstadoValues)
});

export const viajeCobroSchema = z.object({
  cobrado: z.boolean(),
  fecha_cobro: dateOnlySchema.optional().nullable()
});

export type ViajeCreateInput = z.infer<typeof viajeCreateSchema>;
export type ViajeUpdateInput = z.infer<typeof viajeUpdateSchema>;
export type ViajeEstadoInput = z.infer<typeof viajeEstadoSchema>;
export type ViajeCobroInput = z.infer<typeof viajeCobroSchema>;
export type ViajeEstadoApi = (typeof viajeEstadoValues)[number];
