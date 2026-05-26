import { z } from 'zod';

const idSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String);

export const usuarioPropietarioCreateSchema = z.object({
  usuario_id: idSchema,
  propietario_id: idSchema,
  rol_id: idSchema
});

export const usuarioPropietarioUpdateSchema = z
  .object({
    rol_id: idSchema.optional(),
    activo: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export type UsuarioPropietarioCreateInput = z.infer<typeof usuarioPropietarioCreateSchema>;
export type UsuarioPropietarioUpdateInput = z.infer<typeof usuarioPropietarioUpdateSchema>;
