import { z } from 'zod';

const idSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String);

export const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
  propietario_id: idSchema.optional()
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(20),
  password: z.string().min(8, 'La clave debe tener al menos 8 caracteres')
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'La clave actual es obligatoria'),
    new_password: z.string().min(8, 'La nueva clave debe tener al menos 8 caracteres'),
    confirm_password: z.string().min(8, 'La confirmacion debe tener al menos 8 caracteres')
  })
  .refine((input) => input.new_password === input.confirm_password, {
    message: 'La nueva clave y la confirmacion no coinciden',
    path: ['confirm_password']
  })
  .refine((input) => input.current_password !== input.new_password, {
    message: 'La nueva clave debe ser diferente a la actual',
    path: ['new_password']
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
