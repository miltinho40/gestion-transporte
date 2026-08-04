import { z } from 'zod';

export const OWNER_CONFIG_KEYS = [
  'bonificacion_flete_monto_minimo',
  'bonificacion_flete_monto_tramo',
  'bonificacion_flete_valor_tramo',
  'bonificacion_flete_monto_maximo',
  'alerta_mantenimiento_km_anticipacion',
  'alerta_licencia_dias_anticipacion',
  'alerta_viaje_sin_cobrar_semanas'
] as const;

export const SUPER_ADMIN_CONFIG_KEYS = ['precio_galon_diesel'] as const;

export const CONFIG_DEFINITIONS = {
  precio_galon_diesel: {
    nombre: 'Precio galon diesel',
    descripcion: 'Precio referencial global del galon de diesel'
  },
  bonificacion_flete_monto_minimo: {
    nombre: 'Bono - monto minimo',
    descripcion: 'Total semanal de fletes desde el cual se calcula bonificacion'
  },
  bonificacion_flete_monto_tramo: {
    nombre: 'Bono - tramo',
    descripcion: 'Monto de cada tramo de flete para calcular bonificacion semanal'
  },
  bonificacion_flete_valor_tramo: {
    nombre: 'Bono - valor por tramo',
    descripcion: 'Valor de bonificacion por cada tramo de flete semanal'
  },
  bonificacion_flete_monto_maximo: {
    nombre: 'Bono - monto maximo',
    descripcion: 'Tope maximo de bonificacion semanal; 0 significa sin tope'
  },
  alerta_mantenimiento_km_anticipacion: {
    nombre: 'Alerta mantenimiento km',
    descripcion: 'Kilometros de anticipacion para alertar mantenimientos por vencer'
  },
  alerta_licencia_dias_anticipacion: {
    nombre: 'Alerta licencia dias',
    descripcion: 'Dias de anticipacion para alertar licencias por caducar'
  },
  alerta_viaje_sin_cobrar_semanas: {
    nombre: 'Alerta viajes sin cobrar',
    descripcion: 'Semanas maximas para alertar viajes pendientes de cobro'
  }
} as const;

export type OwnerConfigKey = (typeof OWNER_CONFIG_KEYS)[number];
export type SuperAdminConfigKey = (typeof SUPER_ADMIN_CONFIG_KEYS)[number];
export type ConfigKey = OwnerConfigKey | SuperAdminConfigKey;

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

export const configuracionUpdateSchema = z.object({
  valor: z.union([z.string(), z.number()]).transform((value) => String(value).trim()),
  descripcion: optionalTrimmedString(255)
});

export type ConfiguracionUpdateInput = z.infer<typeof configuracionUpdateSchema>;
