import { z } from 'zod';

export const tipoGastoViajeCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  descripcion: z.string().trim().max(255).optional().nullable().transform((value) => value || null),
  activo: z.boolean().optional()
});

export const tipoGastoViajeUpdateSchema = tipoGastoViajeCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Debe enviar al menos un campo para actualizar' }
);

export const tipoGastoViajeEstadoSchema = z.object({
  activo: z.boolean()
});

export type TipoGastoViajeCreateInput = z.infer<typeof tipoGastoViajeCreateSchema>;
export type TipoGastoViajeUpdateInput = z.infer<typeof tipoGastoViajeUpdateSchema>;
export type TipoGastoViajeEstadoInput = z.infer<typeof tipoGastoViajeEstadoSchema>;
