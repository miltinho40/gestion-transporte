import { z } from 'zod';

export const porcentaje = z.number().min(0).max(100);
export const modalidadComisionSchema = z.enum(['AL_PAGAR', 'EN_FACTURA']);
export type ModalidadComision = z.infer<typeof modalidadComisionSchema>;
export const idFactura = z.string().regex(/^[1-9]\d*$/);
export const fechaFactura = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const date = new Date(v + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
  }, 'Fecha inválida');
export const detalleSchema = z.object({
  tipo: z.enum(['propio', 'proveedor']),
  id: idFactura,
  comision_cliente: porcentaje,
  ir_cliente: z.boolean()
});
export const facturaSchema = z
  .object({
    destinatario_id: idFactura,
    numero: z.string().trim().min(1).max(80),
    fecha: fechaFactura,
    comision_empresa: porcentaje,
    ir_empresa: z.boolean(),
    detalles: z.array(detalleSchema).min(1).max(200),
    modalidad_comision: modalidadComisionSchema.default('AL_PAGAR')
  })
  .refine(
    (v) => new Set(v.detalles.map((d) => `${d.tipo}:${d.id}`)).size === v.detalles.length,
    'Hay viajes repetidos'
  );

export const configuracionFacturaSchema = z.object({
  cliente_id: idFactura,
  destinatario_id: idFactura.nullable(),
  porcentaje_comision: porcentaje,
  ir_cliente: z.boolean(),
  ir_empresa: z.boolean(),
  modalidad_comision: modalidadComisionSchema.optional()
});
export const importesConfirmadosSchema = z.object({
  neto_confirmado: z.number().nonnegative(),
  total_facturar_confirmado: z.number().nonnegative()
});
export const crearFacturaSchema = facturaSchema.and(importesConfirmadosSchema);
export const versionFacturaSchema = z.object({ version: z.number().int().nonnegative() });
export const cerrarFacturaSchema = versionFacturaSchema.and(importesConfirmadosSchema);
export const numeroBorradorSchema = z.string().trim().max(80).nullable().optional();
export const listadoFacturasSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().max(150).default('')
});
export const abonoFacturaSchema = z.object({
  fecha: fechaFactura,
  monto: z
    .number()
    .positive()
    .max(9999999999)
    .refine((v) => Number.isInteger(Math.round(v * 10000) / 100), 'Máximo dos decimales'),
  soporte: z.string().trim().min(1).max(120)
});

export type FacturaInput = z.infer<typeof facturaSchema>;
export type CrearFacturaInput = z.infer<typeof crearFacturaSchema>;
export type ConfiguracionFacturaInput = z.infer<typeof configuracionFacturaSchema>;
export type CerrarFacturaInput = z.infer<typeof cerrarFacturaSchema>;
export type ListadoFacturasInput = z.infer<typeof listadoFacturasSchema>;
export type AbonoFacturaInput = z.infer<typeof abonoFacturaSchema>;
