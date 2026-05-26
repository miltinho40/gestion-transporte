import { z } from 'zod';

export const categoriaPeajeCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  numero_ejes: z.coerce.number().int().min(0).optional().nullable(),
  descripcion: z.string().trim().max(255).optional().nullable().transform((value) => value || null),
  activo: z.boolean().optional(),
  global: z.boolean().optional()
});

export const categoriaPeajeUpdateSchema = categoriaPeajeCreateSchema
  .omit({ global: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export const categoriaPeajeEstadoSchema = z.object({
  activo: z.boolean()
});

export type CategoriaPeajeCreateInput = z.infer<typeof categoriaPeajeCreateSchema>;
export type CategoriaPeajeUpdateInput = z.infer<typeof categoriaPeajeUpdateSchema>;
export type CategoriaPeajeEstadoInput = z.infer<typeof categoriaPeajeEstadoSchema>;
