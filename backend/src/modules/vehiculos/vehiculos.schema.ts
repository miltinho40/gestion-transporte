import { z } from 'zod';

export const vehiculoEstadoValues = [
  'disponible',
  'en_viaje',
  'en_mantenimiento',
  'inactivo'
] as const;

const idSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String);

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

export const vehiculoCreateSchema = z.object({
  categoria_peaje_id: idSchema,
  placa: z.string().trim().min(1).max(20),
  marca: z.string().trim().min(1).max(80),
  modelo: optionalTrimmedString(80),
  color: optionalTrimmedString(50),
  anio: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  capacidad: z.coerce.number().int().positive(),
  toneladas: z.coerce.number().positive(),
  kilometraje_actual: z.coerce.number().int().min(0).optional(),
  rendimiento_km_galon: z.coerce.number().positive(),
  estado: z.enum(vehiculoEstadoValues).optional()
});

export const vehiculoUpdateSchema = vehiculoCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Debe enviar al menos un campo para actualizar' }
);

export const vehiculoEstadoSchema = z.object({
  estado: z.enum(vehiculoEstadoValues)
});

export type VehiculoCreateInput = z.infer<typeof vehiculoCreateSchema>;
export type VehiculoUpdateInput = z.infer<typeof vehiculoUpdateSchema>;
export type VehiculoEstadoInput = z.infer<typeof vehiculoEstadoSchema>;
export type VehiculoEstadoApi = (typeof vehiculoEstadoValues)[number];
