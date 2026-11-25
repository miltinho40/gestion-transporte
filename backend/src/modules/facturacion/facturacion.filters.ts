import { z } from 'zod';
import { fechaFactura, idFactura } from './facturacion.schema.js';

const queryList = (value: unknown) => {
  if (value === undefined || value === null || value === '') return [];
  return (Array.isArray(value) ? value : [value])
    .flatMap((v) => (typeof v === 'string' ? v.split(',') : [v]))
    .map((v) => (typeof v === 'string' ? v.trim() : v));
};
const ids = z.preprocess(queryList, z.array(idFactura).max(500));

export const viajesFacturacionFiltersSchema = z.object({
  search: z.string().trim().max(150).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .refine((v) => [25, 50, 100].includes(v), 'Elige 25, 50 o 100 viajes por página')
    .default(25),
  destinatario_id: idFactura.optional(),
  solo_propios: z.enum(['true', 'false']).optional(),
  desde: fechaFactura.optional(),
  hasta: fechaFactura.optional(),
  cliente_ids: ids,
  vehiculo_ids: ids,
  semanas: z.preprocess(queryList, z.array(z.coerce.number().int().min(1).max(53)).max(53))
});

export type ViajesFacturacionFilters = z.infer<typeof viajesFacturacionFiltersSchema>;

// Billing's week column and filter both use the trip's departure date.
export const semanaFacturacion = (fecha: Date) => {
  const date = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  return Math.ceil(((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
};
