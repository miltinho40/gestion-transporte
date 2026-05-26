import { z } from 'zod';

export const tipoCargaCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  descripcion: z.string().trim().max(255).optional().nullable().transform((value) => value || null),
  activo: z.boolean().optional(),
  global: z.boolean().optional()
});

export const tipoCargaUpdateSchema = tipoCargaCreateSchema
  .omit({ global: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export const tipoCargaEstadoSchema = z.object({
  activo: z.boolean()
});

export type TipoCargaCreateInput = z.infer<typeof tipoCargaCreateSchema>;
export type TipoCargaUpdateInput = z.infer<typeof tipoCargaUpdateSchema>;
export type TipoCargaEstadoInput = z.infer<typeof tipoCargaEstadoSchema>;
