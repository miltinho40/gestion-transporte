import { z } from 'zod';

export const viajeProveedorEstadoValues = [
  'programado',
  'en_curso',
  'completado',
  'cancelado'
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

const soporteOperacionSchema = z
  .object({
    fecha: dateOnlySchema.optional().nullable(),
    soporte: optionalTrimmedString(80),
    sin_factura: z.boolean().optional()
  })
  .refine((value) => value.sin_factura || Boolean(value.soporte), {
    message: 'Ingresa el numero de factura/soporte o marca que no se emitio factura'
  });

const viajeProveedorBaseSchema = z.object({
  cliente_id: idSchema,
  proveedor_id: idSchema,
  tarifa_ruta_id: idSchema,
  fecha_salida: dateOnlySchema.optional(),
  fecha_llegada: dateOnlySchema.optional().nullable(),
  descripcion_carga: optionalTrimmedString(1000),
  numeros_guia_remision: guiaRemisionSchema,
  precio_viaje: z.coerce.number().min(0).optional(),
  valor_a_facturar: z.coerce.number().min(0).optional(),
  precio_pagar_proveedor: z.coerce.number().min(0).optional(),
  viaticos: z.coerce.number().min(0).optional(),
  cobrado: z.boolean().optional(),
  fecha_cobro: dateOnlySchema.optional().nullable(),
  soporte_cobro: optionalTrimmedString(80),
  sin_factura_cobro: z.boolean().optional(),
  pagado_proveedor: z.boolean().optional(),
  fecha_pago_proveedor: dateOnlySchema.optional().nullable(),
  soporte_pago_proveedor: optionalTrimmedString(80),
  proveedor_sin_factura: z.boolean().optional(),
  estado: z.enum(viajeProveedorEstadoValues).optional(),
  observaciones: optionalTrimmedString(1000)
});

export const viajeProveedorCreateSchema = viajeProveedorBaseSchema.refine(
  (value) =>
    !value.fecha_salida ||
    !value.fecha_llegada ||
    value.fecha_llegada >= value.fecha_salida,
  {
    message: 'fecha_llegada debe ser mayor o igual a fecha_salida'
  }
);

export const viajeProveedorUpdateSchema = viajeProveedorBaseSchema
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

export const viajeProveedorEstadoSchema = z.object({
  estado: z.enum(viajeProveedorEstadoValues)
});

export const viajeProveedorCobroSchema = z.union([
  soporteOperacionSchema.transform((value) => ({
    cobrado: true,
    fecha_cobro: value.fecha,
    soporte_cobro: value.sin_factura ? null : value.soporte,
    sin_factura_cobro: value.sin_factura ?? false
  })),
  z.object({ cobrado: z.literal(false) }).transform(() => ({
    cobrado: false,
    fecha_cobro: null,
    soporte_cobro: null,
    sin_factura_cobro: false
  }))
]);

export const viajeProveedorPagoSchema = soporteOperacionSchema.transform((value) => ({
  pagado_proveedor: true,
  fecha_pago_proveedor: value.fecha,
  soporte_pago_proveedor: value.sin_factura ? null : value.soporte,
  proveedor_sin_factura: value.sin_factura ?? false
}));

export const viajeProveedorGuiasSchema = z.object({
  numeros_guia_remision: guiaRemisionSchema.refine((value) => value.length > 0, {
    message: 'Debe ingresar al menos una guia'
  })
});

export type ViajeProveedorCreateInput = z.infer<typeof viajeProveedorCreateSchema>;
export type ViajeProveedorUpdateInput = z.infer<typeof viajeProveedorUpdateSchema>;
export type ViajeProveedorEstadoInput = z.infer<typeof viajeProveedorEstadoSchema>;
export type ViajeProveedorCobroInput = z.infer<typeof viajeProveedorCobroSchema>;
export type ViajeProveedorPagoInput = z.infer<typeof viajeProveedorPagoSchema>;
export type ViajeProveedorGuiasInput = z.infer<typeof viajeProveedorGuiasSchema>;
export type ViajeProveedorEstadoApi = (typeof viajeProveedorEstadoValues)[number];
