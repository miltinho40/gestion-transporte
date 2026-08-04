import { z } from 'zod';

const permisosSchema = z.array(z.string().trim().min(1).max(80)).default([]);

export const rolCreateSchema = z.object({
  nombre: z.string().trim().min(2).max(50),
  descripcion: z.string().trim().max(255).optional().nullable(),
  permisos: permisosSchema.optional(),
  permisos_configurados: z.boolean().optional()
});

export const rolUpdateSchema = z
  .object({
    nombre: z.string().trim().min(2).max(50).optional(),
    descripcion: z.string().trim().max(255).optional().nullable(),
    permisos: permisosSchema.optional(),
    permisos_configurados: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export type RolCreateInput = z.infer<typeof rolCreateSchema>;
export type RolUpdateInput = z.infer<typeof rolUpdateSchema>;
