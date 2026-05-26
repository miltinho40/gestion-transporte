import { z } from 'zod';

const idSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String);

export const reporteSemanalBaseFiltersSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  numero_semana: z.coerce.number().int().min(1).max(53),
  cliente_id: idSchema.optional(),
  ruta_id: idSchema.optional()
});

export const reporteViajesConductorFiltersSchema = reporteSemanalBaseFiltersSchema.extend({
  conductor_id: idSchema.optional()
});

export const reporteViajesVehiculoFiltersSchema = reporteSemanalBaseFiltersSchema.extend({
  vehiculo_id: idSchema.optional()
});

export const reporteIngresosEgresosFiltersSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  numero_semana: z.coerce.number().int().min(1).max(53),
  vehiculo_id: idSchema.optional()
});

export type ReporteViajesConductorFilters = z.infer<
  typeof reporteViajesConductorFiltersSchema
>;
export type ReporteViajesVehiculoFilters = z.infer<typeof reporteViajesVehiculoFiltersSchema>;
export type ReporteIngresosEgresosFilters = z.infer<
  typeof reporteIngresosEgresosFiltersSchema
>;
