import { z } from 'zod';

export const conductorEstadoValues = ['activo', 'inactivo', 'licencia_vencida'] as const;

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

export const conductorCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  cedula: z.string().trim().min(1).max(20),
  fecha_nacimiento: dateOnlySchema.optional().nullable(),
  numero_licencia: z.string().trim().min(1).max(50),
  fecha_caducidad_licencia: dateOnlySchema,
  telefono: z.string().trim().min(1).max(30),
  email: z.string().trim().email().max(150).optional().nullable().transform((value) => value || null),
  sueldo_semanal: z.coerce.number().min(0).optional(),
  estado: z.enum(conductorEstadoValues).optional()
});

export const conductorUpdateSchema = conductorCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Debe enviar al menos un campo para actualizar' }
);

export const conductorEstadoSchema = z.object({
  estado: z.enum(conductorEstadoValues)
});

export type ConductorCreateInput = z.infer<typeof conductorCreateSchema>;
export type ConductorUpdateInput = z.infer<typeof conductorUpdateSchema>;
export type ConductorEstadoInput = z.infer<typeof conductorEstadoSchema>;
export type ConductorEstadoApi = (typeof conductorEstadoValues)[number];
