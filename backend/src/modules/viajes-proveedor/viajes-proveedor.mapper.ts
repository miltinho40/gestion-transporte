import { EstadoViaje } from '@prisma/client';
import type { ViajeProveedorEstadoApi } from './viajes-proveedor.schema.js';
import { formatTarifaRuta, type TarifaConRuta } from '../tarifas-ruta/ruta-tarifa.js';

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
  tarifa_ruta?: TarifaConRuta;
  estado: EstadoViaje;
};

export const toPrismaEstadoViajeProveedor = (estado?: ViajeProveedorEstadoApi) => {
  return estado ? apiToPrismaEstadoViaje[estado] : undefined;
};

export const formatViajeProveedor = <T extends ViajeProveedorWithEstado>(viaje: T) => {
  const { estado, ...data } = viaje;
  return {
    ...data,
    ...(viaje.tarifa_ruta ? { tarifa_ruta: formatTarifaRuta(viaje.tarifa_ruta) } : {}),
    estado: prismaToApiEstadoViaje[estado]
  };
};

export const formatViajesProveedor = <T extends ViajeProveedorWithEstado>(viajes: T[]) =>
  viajes.map(formatViajeProveedor);
