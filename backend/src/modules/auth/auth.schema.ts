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

export type LoginInput = z.infer<typeof loginSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
