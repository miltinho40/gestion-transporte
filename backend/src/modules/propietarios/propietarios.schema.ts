import { z } from 'zod';

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe tener formato YYYY-MM-DD');

const propietarioAdminSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(150).toLowerCase(),
  fecha_nacimiento: dateOnlySchema.optional().nullable()
});

export const propietarioCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(150),
  ruc_cedula: z.string().trim().min(1).max(20),
  contacto_nombre: optionalTrimmedString(120),
  telefono: optionalTrimmedString(30),
  email: z.string().trim().email().max(150).optional().nullable().transform((value) => value || null),
  direccion: optionalTrimmedString(255),
  activo: z.boolean().optional(),
  admin: propietarioAdminSchema.optional()
});

export const propietarioUpdateSchema = propietarioCreateSchema
  .omit({ admin: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export const propietarioEstadoSchema = z.object({
  activo: z.boolean()
});

export type PropietarioCreateInput = z.infer<typeof propietarioCreateSchema>;
export type PropietarioUpdateInput = z.infer<typeof propietarioUpdateSchema>;
export type PropietarioEstadoInput = z.infer<typeof propietarioEstadoSchema>;
