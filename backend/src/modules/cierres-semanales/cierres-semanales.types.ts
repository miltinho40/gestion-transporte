import { Prisma } from '@prisma/client';
import { formatGastoSemanal } from './cierres-semanales.mapper.js';

export const BONUS_CONFIG_DEFAULTS = {
  bonificacion_flete_monto_minimo: 1200,
  bonificacion_flete_monto_tramo: 100,
  bonificacion_flete_valor_tramo: 5,
  bonificacion_flete_monto_maximo: 0
} as const;

export type BonusConfigKey = keyof typeof BONUS_CONFIG_DEFAULTS;

export type BonusConfig = Record<BonusConfigKey, Prisma.Decimal>;

export const viajeInclude = {
  detalle_factura: { include: { factura: { select: { estado: true } } } },
  cliente: true,
  vehiculo: true,
  conductor: true,
  tarifa_ruta: {
    include: {
      ruta: true,
      tipo_carga: true
    }
  },
  gastos_viaje: {
    include: {
      tipo_gasto: true
    },
    orderBy: { id: 'asc' }
  }
} satisfies Prisma.ViajeInclude;

export const mantenimientoInclude = {
  vehiculo: true,
  tipo_mantenimiento: true,
  repuestos: {
    orderBy: { id: 'asc' }
  }
} satisfies Prisma.MantenimientoInclude;

export const gastoSemanalInclude = {
  vehiculo: true,
  conductor: true
} satisfies Prisma.GastoSemanalVehiculoInclude;

export type ViajeCierre = Prisma.ViajeGetPayload<{ include: typeof viajeInclude }>;

export type MantenimientoCierre = Prisma.MantenimientoGetPayload<{
  include: typeof mantenimientoInclude;
}>;

export type GastoSemanalCierre = Prisma.GastoSemanalVehiculoGetPayload<{
  include: typeof gastoSemanalInclude;
}>;

export type GastoSemanalFormat = ReturnType<typeof formatGastoSemanal<GastoSemanalCierre>>;
