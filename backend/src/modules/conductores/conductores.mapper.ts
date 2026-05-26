import { EstadoConductor } from '@prisma/client';
import type { ConductorEstadoApi } from './conductores.schema.js';

const prismaToApiEstado = {
  [EstadoConductor.ACTIVO]: 'activo',
  [EstadoConductor.INACTIVO]: 'inactivo',
  [EstadoConductor.LICENCIA_VENCIDA]: 'licencia_vencida'
} satisfies Record<EstadoConductor, ConductorEstadoApi>;

const apiToPrismaEstado = {
  activo: EstadoConductor.ACTIVO,
  inactivo: EstadoConductor.INACTIVO,
  licencia_vencida: EstadoConductor.LICENCIA_VENCIDA
} satisfies Record<ConductorEstadoApi, EstadoConductor>;

export const toPrismaEstadoConductor = (estado?: ConductorEstadoApi) => {
  return estado ? apiToPrismaEstado[estado] : undefined;
};

export const formatConductor = <T extends { estado: EstadoConductor }>(conductor: T) => {
  return {
    ...conductor,
    estado: prismaToApiEstado[conductor.estado]
  };
};

export const formatConductores = <T extends { estado: EstadoConductor }>(conductores: T[]) => {
  return conductores.map(formatConductor);
};
