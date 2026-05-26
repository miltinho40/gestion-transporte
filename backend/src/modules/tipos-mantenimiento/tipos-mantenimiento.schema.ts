import { z } from 'zod';

const baseTipoMantenimientoSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  descripcion: z.string().trim().max(255).optional().nullable().transform((value) => value || null),
  es_periodico: z.boolean().optional(),
  intervalo_km: z.coerce.number().int().positive().optional().nullable(),
  intervalo_dias: z.coerce.number().int().positive().optional().nullable(),
  activo: z.boolean().optional()
});

export const tipoMantenimientoCreateSchema = baseTipoMantenimientoSchema
  .extend({
    global: z.boolean().optional()
  })
  .refine(
    (value) =>
      !value.es_periodico || value.intervalo_km != null || value.intervalo_dias != null,
    {
      message: 'Un mantenimiento periodico debe tener intervalo_km o intervalo_dias'
    }
  );

export const tipoMantenimientoUpdateSchema = baseTipoMantenimientoSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export const tipoMantenimientoEstadoSchema = z.object({
  activo: z.boolean()
});

export type TipoMantenimientoCreateInput = z.infer<typeof tipoMantenimientoCreateSchema>;
export type TipoMantenimientoUpdateInput = z.infer<typeof tipoMantenimientoUpdateSchema>;
export type TipoMantenimientoEstadoInput = z.infer<typeof tipoMantenimientoEstadoSchema>;
