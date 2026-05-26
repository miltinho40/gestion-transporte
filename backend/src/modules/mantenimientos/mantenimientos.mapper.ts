import { EstadoMantenimiento, EstadoVehiculo } from '@prisma/client';
import type { MantenimientoEstadoApi } from './mantenimientos.schema.js';

const prismaToApiEstadoMantenimiento = {
  [EstadoMantenimiento.PROGRAMADO]: 'programado',
  [EstadoMantenimiento.REALIZADO]: 'realizado',
  [EstadoMantenimiento.CANCELADO]: 'cancelado',
  [EstadoMantenimiento.VENCIDO]: 'vencido'
} satisfies Record<EstadoMantenimiento, MantenimientoEstadoApi>;

const apiToPrismaEstadoMantenimiento = {
  programado: EstadoMantenimiento.PROGRAMADO,
  realizado: EstadoMantenimiento.REALIZADO,
  cancelado: EstadoMantenimiento.CANCELADO,
  vencido: EstadoMantenimiento.VENCIDO
} satisfies Record<MantenimientoEstadoApi, EstadoMantenimiento>;

const prismaToApiEstadoVehiculo = {
  [EstadoVehiculo.DISPONIBLE]: 'disponible',
  [EstadoVehiculo.EN_VIAJE]: 'en_viaje',
  [EstadoVehiculo.EN_MANTENIMIENTO]: 'en_mantenimiento',
  [EstadoVehiculo.INACTIVO]: 'inactivo'
};

type MantenimientoWithOptionalRelations = {
  estado: EstadoMantenimiento;
  vehiculo?: { estado: EstadoVehiculo } | null;
};

export const toPrismaEstadoMantenimiento = (estado?: MantenimientoEstadoApi) => {
  return estado ? apiToPrismaEstadoMantenimiento[estado] : undefined;
};

export const formatMantenimiento = <T extends MantenimientoWithOptionalRelations>(
  mantenimiento: T
) => {
  return {
    ...mantenimiento,
    estado: prismaToApiEstadoMantenimiento[mantenimiento.estado],
    vehiculo: mantenimiento.vehiculo
      ? {
          ...mantenimiento.vehiculo,
          estado: prismaToApiEstadoVehiculo[mantenimiento.vehiculo.estado]
        }
      : mantenimiento.vehiculo
  };
};

export const formatMantenimientos = <T extends MantenimientoWithOptionalRelations>(
  mantenimientos: T[]
) => {
  return mantenimientos.map(formatMantenimiento);
};
