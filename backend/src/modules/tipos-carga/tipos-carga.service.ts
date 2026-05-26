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
  TipoCargaCreateInput,
  TipoCargaEstadoInput,
  TipoCargaUpdateInput
} from './tipos-carga.schema.js';

interface ListFilters {
  search?: unknown;
  activo?: unknown;
}

const buildWhere = (
  user: JwtPayload | undefined,
  filters: ListFilters
): Prisma.TipoCargaWhereInput => {
  const scope = resolveReadScope(user);
  const where: Prisma.TipoCargaWhereInput = {};

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

  return where;
};

const ensureNombreAvailable = async (
  propietarioId: bigint | null,
  nombre: string,
  excludeId?: bigint
) => {
  const existing = await prisma.tipoCarga.findFirst({
    where: {
      propietario_id: propietarioId,
      nombre
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe un tipo de carga con ese nombre en este alcance', 409);
  }
};

export const listTiposCarga = async (user: JwtPayload | undefined, filters: ListFilters) => {
  return prisma.tipoCarga.findMany({
    where: buildWhere(user, filters),
    orderBy: [{ activo: 'desc' }, { propietario_id: 'asc' }, { nombre: 'asc' }]
  });
};

export const getTipoCargaById = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const scope = resolveReadScope(user);
  const tipo = await prisma.tipoCarga.findFirst({
    where: {
      id,
      ...(scope.all ? {} : { OR: [{ propietario_id: null }, { propietario_id: scope.propietarioId }] })
    }
  });

  if (!tipo) throw new AppError('Tipo de carga no encontrado', 404);

  return tipo;
};

export const createTipoCarga = async (
  user: JwtPayload | undefined,
  input: TipoCargaCreateInput
) => {
  const propietarioId = resolveWriteOwnerId(user, input.global);
  await ensureNombreAvailable(propietarioId, input.nombre);

  return prisma.tipoCarga.create({
    data: {
      propietario_id: propietarioId,
      nombre: input.nombre,
      descripcion: input.descripcion,
      activo: input.activo ?? true
    }
  });
};

export const updateTipoCarga = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: TipoCargaUpdateInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getTipoCargaById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  if (input.nombre) await ensureNombreAvailable(current.propietario_id, input.nombre, id);

  return prisma.tipoCarga.update({
    where: { id },
    data: input
  });
};

export const updateEstadoTipoCarga = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: TipoCargaEstadoInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getTipoCargaById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.tipoCarga.update({
    where: { id },
    data: { activo: input.activo }
  });
};

export const deactivateTipoCarga = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const current = await getTipoCargaById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.tipoCarga.update({
    where: { id },
    data: { activo: false }
  });
};
