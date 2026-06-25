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

const splitGuiasRemision = (value: string | string[] | undefined) => {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  return values
    .flatMap((item) => item.split(/[\n,;-]+/))
    .map((item) => item.trim())
    .filter(Boolean);
};

const guiaRemisionSchema = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform(splitGuiasRemision)
  .pipe(z.array(z.string().min(1).max(80)));

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
  viaticos: z.coerce.number().min(0).optional(),
  costo_real_gastos: z.coerce.number().min(0).optional().nullable(),
  cobrado: z.boolean().optional(),
  retorno: z.boolean().optional(),
  fecha_cobro: dateOnlySchema.optional().nullable(),
  soporte_cobro: optionalTrimmedString(80),
  sin_factura_cobro: z.boolean().optional(),
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

export const viajeCobroSchema = z
  .object({
    cobrado: z.boolean(),
    fecha_cobro: dateOnlySchema.optional().nullable(),
    soporte_cobro: optionalTrimmedString(80),
    sin_factura_cobro: z.boolean().optional()
  })
  .refine((value) => !value.cobrado || value.sin_factura_cobro || Boolean(value.soporte_cobro), {
    message: 'Ingresa el numero de factura/soporte o marca que no se emitio factura'
  });

export const viajeGuiasSchema = z.object({
  numeros_guia_remision: guiaRemisionSchema.refine((value) => value.length > 0, {
    message: 'Debe ingresar al menos una guia'
  })
});

export type ViajeCreateInput = z.infer<typeof viajeCreateSchema>;
export type ViajeUpdateInput = z.infer<typeof viajeUpdateSchema>;
export type ViajeEstadoInput = z.infer<typeof viajeEstadoSchema>;
export type ViajeCobroInput = z.infer<typeof viajeCobroSchema>;
export type ViajeGuiasInput = z.infer<typeof viajeGuiasSchema>;
export type ViajeEstadoApi = (typeof viajeEstadoValues)[number];
