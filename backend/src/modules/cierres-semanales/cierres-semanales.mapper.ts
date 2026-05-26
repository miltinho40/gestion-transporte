import {
  EstadoConductor,
  EstadoVehiculo,
  TipoGastoSemanalVehiculo
} from '@prisma/client';
import type { TipoGastoSemanalApi } from './cierres-semanales.schema.js';

export const prismaToApiTipoGastoSemanal = {
  [TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR]: 'bonificacion_conductor',
  [TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR]: 'sueldo_conductor',
  [TipoGastoSemanalVehiculo.VARIOS]: 'varios',
  [TipoGastoSemanalVehiculo.OTRO]: 'otro'
} satisfies Record<TipoGastoSemanalVehiculo, TipoGastoSemanalApi>;

const apiToPrismaTipoGastoSemanal = {
  bonificacion_conductor: TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR,
  sueldo_conductor: TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR,
  varios: TipoGastoSemanalVehiculo.VARIOS,
  otro: TipoGastoSemanalVehiculo.OTRO
} satisfies Record<TipoGastoSemanalApi, TipoGastoSemanalVehiculo>;

const prismaToApiEstadoVehiculo = {
  [EstadoVehiculo.DISPONIBLE]: 'disponible',
  [EstadoVehiculo.EN_VIAJE]: 'en_viaje',
  [EstadoVehiculo.EN_MANTENIMIENTO]: 'en_mantenimiento',
  [EstadoVehiculo.INACTIVO]: 'inactivo'
};

const prismaToApiEstadoConductor = {
  [EstadoConductor.ACTIVO]: 'activo',
  [EstadoConductor.INACTIVO]: 'inactivo',
  [EstadoConductor.LICENCIA_VENCIDA]: 'licencia_vencida'
};

type GastoWithOptionalRelations = {
  tipo: TipoGastoSemanalVehiculo;
  vehiculo?: { estado: EstadoVehiculo } | null;
  conductor?: { estado: EstadoConductor } | null;
};

export const toPrismaTipoGastoSemanal = (tipo?: TipoGastoSemanalApi) => {
  return tipo ? apiToPrismaTipoGastoSemanal[tipo] : undefined;
};

export const formatGastoSemanal = <T extends GastoWithOptionalRelations>(gasto: T) => {
  const { tipo, vehiculo, conductor, ...rest } = gasto;

  return {
    ...rest,
    tipo: prismaToApiTipoGastoSemanal[tipo],
    vehiculo: vehiculo
      ? {
          ...vehiculo,
          estado: prismaToApiEstadoVehiculo[vehiculo.estado]
        }
      : vehiculo,
    conductor: conductor
      ? {
          ...conductor,
          estado: prismaToApiEstadoConductor[conductor.estado]
        }
      : conductor
  };
};

export const formatGastosSemanales = <T extends GastoWithOptionalRelations>(gastos: T[]) => {
  return gastos.map(formatGastoSemanal);
};
