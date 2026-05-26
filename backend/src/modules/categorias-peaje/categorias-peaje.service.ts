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
  CategoriaPeajeCreateInput,
  CategoriaPeajeEstadoInput,
  CategoriaPeajeUpdateInput
} from './categorias-peaje.schema.js';

interface ListFilters {
  search?: unknown;
  activo?: unknown;
}

const buildWhere = (user: JwtPayload | undefined, filters: ListFilters): Prisma.CategoriaPeajeWhereInput => {
  resolveReadScope(user);
  const where: Prisma.CategoriaPeajeWhereInput = {};

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
  const existing = await prisma.categoriaPeaje.findFirst({
    where: {
      propietario_id: propietarioId,
      nombre
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe una categoria de peaje con ese nombre en este alcance', 409);
  }
};

export const listCategoriasPeaje = async (user: JwtPayload | undefined, filters: ListFilters) => {
  return prisma.categoriaPeaje.findMany({
    where: buildWhere(user, filters),
    orderBy: [{ activo: 'desc' }, { propietario_id: 'asc' }, { nombre: 'asc' }]
  });
};

export const getCategoriaPeajeById = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const scope = resolveReadScope(user);

  const categoria = await prisma.categoriaPeaje.findFirst({
    where: {
      id,
      ...(user?.es_super_admin || scope.all
        ? {}
        : { OR: [{ propietario_id: null }, { propietario_id: scope.propietarioId }] })
    }
  });

  if (!categoria) {
    throw new AppError('Categoria de peaje no encontrada', 404);
  }

  return categoria;
};

export const createCategoriaPeaje = async (
  user: JwtPayload | undefined,
  input: CategoriaPeajeCreateInput
) => {
  const propietarioId = resolveWriteOwnerId(user, input.global);
  await ensureNombreAvailable(propietarioId, input.nombre);

  return prisma.categoriaPeaje.create({
    data: {
      propietario_id: propietarioId,
      nombre: input.nombre,
      numero_ejes: input.numero_ejes ?? null,
      descripcion: input.descripcion,
      activo: input.activo ?? true
    }
  });
};

export const updateCategoriaPeaje = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: CategoriaPeajeUpdateInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getCategoriaPeajeById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  if (input.nombre) {
    await ensureNombreAvailable(current.propietario_id, input.nombre, id);
  }

  return prisma.categoriaPeaje.update({
    where: { id },
    data: input
  });
};

export const updateEstadoCategoriaPeaje = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: CategoriaPeajeEstadoInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getCategoriaPeajeById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.categoriaPeaje.update({
    where: { id },
    data: { activo: input.activo }
  });
};

export const deactivateCategoriaPeaje = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const current = await getCategoriaPeajeById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.categoriaPeaje.update({
    where: { id },
    data: { activo: false }
  });
};
