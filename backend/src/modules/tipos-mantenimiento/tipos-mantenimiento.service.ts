import { Prisma } from '@prisma/client';
import type { JwtPayload } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import {
  assertCanWriteScopedRecord,
  resolveReadScope,
  resolveWriteOwnerId
} from '../../utils/ownership-scope.js';
import type {
  TipoMantenimientoCreateInput,
  TipoMantenimientoEstadoInput,
  TipoMantenimientoUpdateInput
} from './tipos-mantenimiento.schema.js';

interface ListFilters {
  search?: unknown;
  activo?: unknown;
  es_periodico?: unknown;
}

const buildWhere = (
  user: JwtPayload | undefined,
  filters: ListFilters
): Prisma.TipoMantenimientoWhereInput => {
  const scope = resolveReadScope(user);
  const where: Prisma.TipoMantenimientoWhereInput = {};

  if (!scope.all) {
    where.OR = [{ propietario_id: null }, { propietario_id: scope.propietarioId }];
  }

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.AND = [
      {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { descripcion: { contains: search, mode: 'insensitive' } }
        ]
      }
    ];
  }

  if (filters.activo === 'true') where.activo = true;
  if (filters.activo === 'false') where.activo = false;
  if (filters.es_periodico === 'true') where.es_periodico = true;
  if (filters.es_periodico === 'false') where.es_periodico = false;

  return where;
};

const ensureNombreAvailable = async (
  propietarioId: bigint | null,
  nombre: string,
  excludeId?: bigint
) => {
  const existing = await prisma.tipoMantenimiento.findFirst({
    where: {
      propietario_id: propietarioId,
      nombre
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe un tipo de mantenimiento con ese nombre en este alcance', 409);
  }
};

export const listTiposMantenimiento = async (
  user: JwtPayload | undefined,
  filters: ListFilters
) => {
  return prisma.tipoMantenimiento.findMany({
    where: buildWhere(user, filters),
    orderBy: [{ activo: 'desc' }, { propietario_id: 'asc' }, { nombre: 'asc' }]
  });
};

export const getTipoMantenimientoById = async (
  user: JwtPayload | undefined,
  idInput: unknown
) => {
  const id = parseBigIntId(idInput);
  const scope = resolveReadScope(user);

  const tipo = await prisma.tipoMantenimiento.findFirst({
    where: {
      id,
      ...(scope.all ? {} : { OR: [{ propietario_id: null }, { propietario_id: scope.propietarioId }] })
    }
  });

  if (!tipo) {
    throw new AppError('Tipo de mantenimiento no encontrado', 404);
  }

  return tipo;
};

export const createTipoMantenimiento = async (
  user: JwtPayload | undefined,
  input: TipoMantenimientoCreateInput
) => {
  const propietarioId = resolveWriteOwnerId(user, input.global);
  await ensureNombreAvailable(propietarioId, input.nombre);

  return prisma.tipoMantenimiento.create({
    data: {
      propietario_id: propietarioId,
      nombre: input.nombre,
      descripcion: input.descripcion,
      es_periodico: input.es_periodico ?? false,
      intervalo_km: input.intervalo_km ?? null,
      intervalo_dias: input.intervalo_dias ?? null,
      activo: input.activo ?? true
    }
  });
};

export const updateTipoMantenimiento = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: TipoMantenimientoUpdateInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getTipoMantenimientoById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  if (input.nombre) {
    await ensureNombreAvailable(current.propietario_id, input.nombre, id);
  }

  return prisma.tipoMantenimiento.update({
    where: { id },
    data: input
  });
};

export const updateEstadoTipoMantenimiento = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: TipoMantenimientoEstadoInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getTipoMantenimientoById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.tipoMantenimiento.update({
    where: { id },
    data: { activo: input.activo }
  });
};

export const deactivateTipoMantenimiento = async (
  user: JwtPayload | undefined,
  idInput: unknown
) => {
  const id = parseBigIntId(idInput);
  const current = await getTipoMantenimientoById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.tipoMantenimiento.update({
    where: { id },
    data: { activo: false }
  });
};
