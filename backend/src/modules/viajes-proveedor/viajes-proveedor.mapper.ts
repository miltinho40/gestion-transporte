import { EstadoViaje } from '@prisma/client';
import type { ViajeProveedorEstadoApi } from './viajes-proveedor.schema.js';

const prismaToApiEstadoViaje = {
  [EstadoViaje.PROGRAMADO]: 'programado',
  [EstadoViaje.EN_CURSO]: 'en_curso',
  [EstadoViaje.COMPLETADO]: 'completado',
  [EstadoViaje.CANCELADO]: 'cancelado'
} satisfies Record<EstadoViaje, ViajeProveedorEstadoApi>;

const apiToPrismaEstadoViaje = {
  programado: EstadoViaje.PROGRAMADO,
  en_curso: EstadoViaje.EN_CURSO,
  completado: EstadoViaje.COMPLETADO,
  cancelado: EstadoViaje.CANCELADO
} satisfies Record<ViajeProveedorEstadoApi, EstadoViaje>;

type ViajeProveedorWithEstado = {
  estado: EstadoViaje;
};

export const toPrismaEstadoViajeProveedor = (estado?: ViajeProveedorEstadoApi) => {
  return estado ? apiToPrismaEstadoViaje[estado] : undefined;
};

export const formatViajeProveedor = <T extends ViajeProveedorWithEstado>(viaje: T) => ({
  ...viaje,
  estado: prismaToApiEstadoViaje[viaje.estado]
});

export const formatViajesProveedor = <T extends ViajeProveedorWithEstado>(viajes: T[]) =>
  viajes.map(formatViajeProveedor);
