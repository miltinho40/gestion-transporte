import { z } from 'zod';

export const asistenteMensajeSchema = z.object({
  mensaje: z.string().trim().min(1).max(1200),
  conversacion_id: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).optional(),
  canal: z.enum(['web', 'movil']).default('web'),
  contexto: z
    .object({
      draft: z
        .object({
          tipo: z.enum([
            'viaje',
            'mantenimiento',
            'cliente',
            'vehiculo',
            'conductor',
            'preferencia'
          ]),
          titulo: z.string(),
          campos: z.record(z.string(), z.string()),
          advertencias: z.array(z.string())
        })
        .optional(),
      action: z
        .object({
          label: z.string(),
          route: z.string(),
          query: z.record(z.string(), z.string()),
          operacion: z.enum(['abrir', 'guardar', 'editar']).optional()
        })
        .optional(),
      confirmar: z.boolean().optional(),
      consulta: z
        .object({
          tipo: z.enum(['viajes', 'analitica_viajes']),
          filtros: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        })
        .optional()
    })
    .optional()
});

export type AsistenteMensajeInput = z.infer<typeof asistenteMensajeSchema>;
