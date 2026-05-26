import { z } from 'zod';

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe tener formato YYYY-MM-DD');

export const usuarioCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(150).toLowerCase(),
  password: z.string().min(8).max(100),
  fecha_nacimiento: dateOnlySchema.optional().nullable(),
  es_super_admin: z.boolean().optional(),
  activo: z.boolean().optional()
});

export const usuarioUpdateSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(150).toLowerCase().optional(),
    fecha_nacimiento: dateOnlySchema.optional().nullable(),
    es_super_admin: z.boolean().optional(),
    activo: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export const usuarioEstadoSchema = z.object({
  activo: z.boolean()
});

export const usuarioPasswordSchema = z.object({
  password: z.string().min(8).max(100)
});

export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>;
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>;
export type UsuarioEstadoInput = z.infer<typeof usuarioEstadoSchema>;
export type UsuarioPasswordInput = z.infer<typeof usuarioPasswordSchema>;
