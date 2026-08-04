import { z } from 'zod';

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

export const proveedorCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(150),
  ruc_cedula: z.string().trim().min(1).max(20),
  telefono: optionalTrimmedString(30),
  email: z
    .string()
    .trim()
    .email()
    .max(150)
    .optional()
    .nullable()
    .transform((value) => value || null),
  observacion: optionalTrimmedString(255),
  porcentaje_utilidad: z.coerce.number().min(0).max(100).optional(),
  activo: z.boolean().optional()
});

export const proveedorUpdateSchema = proveedorCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Debe enviar al menos un campo para actualizar' }
);

export const proveedorEstadoSchema = z.object({
  activo: z.boolean()
});

export type ProveedorCreateInput = z.infer<typeof proveedorCreateSchema>;
export type ProveedorUpdateInput = z.infer<typeof proveedorUpdateSchema>;
export type ProveedorEstadoInput = z.infer<typeof proveedorEstadoSchema>;
