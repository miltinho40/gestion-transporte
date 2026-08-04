import { EstadoSuscripcionPropietario, EstadoVehiculo } from '@prisma/client';
import type { EstadoSuscripcionApi } from './propietarios.schema.js';

const prismaToApiEstadoSuscripcion = {
  [EstadoSuscripcionPropietario.ACTIVA]: 'activa',
  [EstadoSuscripcionPropietario.PRUEBA]: 'prueba',
  [EstadoSuscripcionPropietario.SUSPENDIDA]: 'suspendida',
  [EstadoSuscripcionPropietario.CANCELADA]: 'cancelada'
} satisfies Record<EstadoSuscripcionPropietario, EstadoSuscripcionApi>;

const apiToPrismaEstadoSuscripcion = {
  activa: EstadoSuscripcionPropietario.ACTIVA,
  prueba: EstadoSuscripcionPropietario.PRUEBA,
  suspendida: EstadoSuscripcionPropietario.SUSPENDIDA,
  cancelada: EstadoSuscripcionPropietario.CANCELADA
} satisfies Record<EstadoSuscripcionApi, EstadoSuscripcionPropietario>;

export const toPrismaEstadoSuscripcion = (estado?: EstadoSuscripcionApi | null) => {
  return estado ? apiToPrismaEstadoSuscripcion[estado] : undefined;
};

export const formatPropietario = <
  T extends {
    estado_suscripcion: EstadoSuscripcionPropietario;
    limite_vehiculos: number;
    precio_por_vehiculo: unknown;
    vehiculos?: { estado: EstadoVehiculo; facturable: boolean }[];
  }
>(
  propietario: T
) => {
  const vehiculosFacturables = (propietario.vehiculos ?? []).filter(
    (vehiculo) => vehiculo.facturable && vehiculo.estado !== EstadoVehiculo.INACTIVO
  ).length;
  const precioPorVehiculo = Number(propietario.precio_por_vehiculo ?? 0);

  return {
    ...propietario,
    estado_suscripcion: prismaToApiEstadoSuscripcion[propietario.estado_suscripcion],
    vehiculos_facturables: vehiculosFacturables,
    uso_vehiculos: propietario.limite_vehiculos
      ? `${vehiculosFacturables}/${propietario.limite_vehiculos}`
      : `${vehiculosFacturables}/sin limite`,
    total_mensual_estimado: Number.isFinite(precioPorVehiculo)
      ? Number((vehiculosFacturables * precioPorVehiculo).toFixed(2))
      : 0
  };
};

export const formatPropietarios = <
  T extends {
    estado_suscripcion: EstadoSuscripcionPropietario;
    limite_vehiculos: number;
    precio_por_vehiculo: unknown;
    vehiculos?: { estado: EstadoVehiculo; facturable: boolean }[];
  }
>(
  propietarios: T[]
) => propietarios.map(formatPropietario);
