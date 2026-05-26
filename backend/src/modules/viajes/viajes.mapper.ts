import { EstadoConductor, EstadoVehiculo, EstadoViaje } from '@prisma/client';
import type { ViajeEstadoApi } from './viajes.schema.js';

const prismaToApiEstadoViaje = {
  [EstadoViaje.PROGRAMADO]: 'programado',
  [EstadoViaje.EN_CURSO]: 'en_curso',
  [EstadoViaje.COMPLETADO]: 'completado',
  [EstadoViaje.CANCELADO]: 'cancelado'
} satisfies Record<EstadoViaje, ViajeEstadoApi>;

const apiToPrismaEstadoViaje = {
  programado: EstadoViaje.PROGRAMADO,
  en_curso: EstadoViaje.EN_CURSO,
  completado: EstadoViaje.COMPLETADO,
  cancelado: EstadoViaje.CANCELADO
} satisfies Record<ViajeEstadoApi, EstadoViaje>;

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

type ViajeWithOptionalRelations = {
  estado: EstadoViaje;
  vehiculo?: { estado: EstadoVehiculo } | null;
  conductor?: { estado: EstadoConductor } | null;
};

export const toPrismaEstadoViaje = (estado?: ViajeEstadoApi) => {
  return estado ? apiToPrismaEstadoViaje[estado] : undefined;
};

export const formatViaje = <T extends ViajeWithOptionalRelations>(viaje: T) => {
  return {
    ...viaje,
    estado: prismaToApiEstadoViaje[viaje.estado],
    vehiculo: viaje.vehiculo
      ? {
          ...viaje.vehiculo,
          estado: prismaToApiEstadoVehiculo[viaje.vehiculo.estado]
        }
      : viaje.vehiculo,
    conductor: viaje.conductor
      ? {
          ...viaje.conductor,
          estado: prismaToApiEstadoConductor[viaje.conductor.estado]
        }
      : viaje.conductor
  };
};

export const formatViajes = <T extends ViajeWithOptionalRelations>(viajes: T[]) => {
  return viajes.map(formatViaje);
};
