import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import type {
  TipoGastoViajeCreateInput,
  TipoGastoViajeEstadoInput,
  TipoGastoViajeUpdateInput
} from './tipos-gasto-viaje.schema.js';

interface ListFilters {
  search?: unknown;
  activo?: unknown;
}

const buildWhere = (filters: ListFilters): Prisma.TipoGastoViajeWhereInput => {
  const where: Prisma.TipoGastoViajeWhereInput = {};

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { descripcion: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (filters.activo === 'true') where.activo = true;
  if (filters.activo === 'false') where.activo = false;

  return where;
};

const ensureNombreAvailable = async (nombre: string, excludeId?: bigint) => {
  const existing = await prisma.tipoGastoViaje.findUnique({ where: { nombre } });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe un tipo de gasto de viaje con ese nombre', 409);
  }
};

export const listTiposGastoViaje = async (filters: ListFilters) => {
  return prisma.tipoGastoViaje.findMany({
    where: buildWhere(filters),
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }]
  });
};

export const getTipoGastoViajeById = async (idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const tipo = await prisma.tipoGastoViaje.findUnique({ where: { id } });

  if (!tipo) throw new AppError('Tipo de gasto de viaje no encontrado', 404);

  return tipo;
};

export const createTipoGastoViaje = async (input: TipoGastoViajeCreateInput) => {
  await ensureNombreAvailable(input.nombre);

  return prisma.tipoGastoViaje.create({
    data: {
      nombre: input.nombre,
      descripcion: input.descripcion,
      activo: input.activo ?? true
    }
  });
};

export const updateTipoGastoViaje = async (
  idInput: unknown,
  input: TipoGastoViajeUpdateInput
) => {
  const id = parseBigIntId(idInput);
  await getTipoGastoViajeById(id);

  if (input.nombre) await ensureNombreAvailable(input.nombre, id);

  return prisma.tipoGastoViaje.update({
    where: { id },
    data: input
  });
};

export const updateEstadoTipoGastoViaje = async (
  idInput: unknown,
  input: TipoGastoViajeEstadoInput
) => {
  const id = parseBigIntId(idInput);
  await getTipoGastoViajeById(id);

  return prisma.tipoGastoViaje.update({
    where: { id },
    data: { activo: input.activo }
  });
};

export const deactivateTipoGastoViaje = async (idInput: unknown) => {
  const id = parseBigIntId(idInput);
  await getTipoGastoViajeById(id);

  return prisma.tipoGastoViaje.update({
    where: { id },
    data: { activo: false }
  });
};
