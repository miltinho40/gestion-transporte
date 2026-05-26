import { EstadoVehiculo } from '@prisma/client';
import type { VehiculoEstadoApi } from './vehiculos.schema.js';

const prismaToApiEstado = {
  [EstadoVehiculo.DISPONIBLE]: 'disponible',
  [EstadoVehiculo.EN_VIAJE]: 'en_viaje',
  [EstadoVehiculo.EN_MANTENIMIENTO]: 'en_mantenimiento',
  [EstadoVehiculo.INACTIVO]: 'inactivo'
} satisfies Record<EstadoVehiculo, VehiculoEstadoApi>;

const apiToPrismaEstado = {
  disponible: EstadoVehiculo.DISPONIBLE,
  en_viaje: EstadoVehiculo.EN_VIAJE,
  en_mantenimiento: EstadoVehiculo.EN_MANTENIMIENTO,
  inactivo: EstadoVehiculo.INACTIVO
} satisfies Record<VehiculoEstadoApi, EstadoVehiculo>;

export const toPrismaEstadoVehiculo = (estado?: VehiculoEstadoApi) => {
  return estado ? apiToPrismaEstado[estado] : undefined;
};

export const formatVehiculo = <T extends { estado: EstadoVehiculo }>(vehiculo: T) => {
  return {
    ...vehiculo,
    estado: prismaToApiEstado[vehiculo.estado]
  };
};

export const formatVehiculos = <T extends { estado: EstadoVehiculo }>(vehiculos: T[]) => {
  return vehiculos.map(formatVehiculo);
};
