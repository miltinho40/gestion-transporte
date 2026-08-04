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
            'viaje_proveedor',
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
          tipo: z.enum(['viajes', 'analitica_viajes', 'viajes_proveedor', 'mantenimientos']),
          filtros: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        })
        .optional()
    })
    .optional()
});

export type AsistenteMensajeInput = z.infer<typeof asistenteMensajeSchema>;

export const asistenteEvaluacionSchema = z.object({
  calificacion: z.enum(['correcta', 'incorrecta']),
  correccion: z.string().trim().max(1200).nullable().optional()
});

export type AsistenteEvaluacionInput = z.infer<typeof asistenteEvaluacionSchema>;

export const asistenteRevisionSchema = z.object({
  estado: z.enum(['pendiente', 'revisada', 'descartada'])
});

export type AsistenteRevisionInput = z.infer<typeof asistenteRevisionSchema>;
