import { z } from 'zod';

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

export const clienteCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(150),
  ruc_cedula: z.string().trim().min(1).max(20),
  contacto_nombre: optionalTrimmedString(120),
  telefono: optionalTrimmedString(30),
  email: z.string().trim().email().max(150).optional().nullable().transform((value) => value || null),
  direccion: optionalTrimmedString(255),
  porcentaje_comision: z.coerce.number().min(0).max(100).optional(),
  activo: z.boolean().optional()
});

export const clienteUpdateSchema = clienteCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Debe enviar al menos un campo para actualizar' }
);

export const clienteEstadoSchema = z.object({
  activo: z.boolean()
});

export type ClienteCreateInput = z.infer<typeof clienteCreateSchema>;
export type ClienteUpdateInput = z.infer<typeof clienteUpdateSchema>;
export type ClienteEstadoInput = z.infer<typeof clienteEstadoSchema>;
