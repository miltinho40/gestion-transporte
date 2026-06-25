import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import { buildPaginatedResult, parsePagination } from '../../utils/pagination.js';
import type {
  ProveedorCreateInput,
  ProveedorEstadoInput,
  ProveedorUpdateInput
} from './proveedores.schema.js';

interface ListProveedoresFilters {
  search?: unknown;
  activo?: unknown;
}

const buildWhere = (
  propietarioId: bigint,
  filters: ListProveedoresFilters
): Prisma.ProveedorWhereInput => {
  const where: Prisma.ProveedorWhereInput = {
    propietario_id: propietarioId
  };

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { ruc_cedula: { contains: search, mode: 'insensitive' } },
      { telefono: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (filters.activo === 'true') where.activo = true;
  if (filters.activo === 'false') where.activo = false;

  return where;
};

const ensureRucAvailable = async (
  propietarioId: bigint,
  rucCedula: string,
  excludeId?: bigint
) => {
  const existing = await prisma.proveedor.findUnique({
    where: {
      propietario_id_ruc_cedula: {
        propietario_id: propietarioId,
        ruc_cedula: rucCedula
      }
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe un proveedor con ese RUC/cedula para este propietario', 409);
  }
};

export const listProveedores = async (
  propietarioIdInput: unknown,
  filters: ListProveedoresFilters
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const where = buildWhere(propietarioId, filters);
  const orderBy = [
    { activo: 'desc' },
    { nombre: 'asc' }
  ] satisfies Prisma.ProveedorOrderByWithRelationInput[];
  const pagination = parsePagination(filters as Record<string, unknown>);

  if (!pagination) {
    return prisma.proveedor.findMany({ where, orderBy });
  }

  const [data, total] = await prisma.$transaction([
    prisma.proveedor.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit
    }),
    prisma.proveedor.count({ where })
  ]);

  return buildPaginatedResult(data, total, pagination);
};

export const getProveedorById = async (propietarioIdInput: unknown, idInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const proveedor = await prisma.proveedor.findFirst({
    where: {
      id,
      propietario_id: propietarioId
    }
  });

  if (!proveedor) {
    throw new AppError('Proveedor no encontrado', 404);
  }

  return proveedor;
};

export const createProveedor = async (
  propietarioIdInput: unknown,
  input: ProveedorCreateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');

  await ensureRucAvailable(propietarioId, input.ruc_cedula);

  return prisma.proveedor.create({
    data: {
      propietario_id: propietarioId,
      nombre: input.nombre,
      ruc_cedula: input.ruc_cedula,
      telefono: input.telefono,
      email: input.email,
      observacion: input.observacion,
      porcentaje_utilidad: input.porcentaje_utilidad ?? 0,
      activo: input.activo ?? true
    }
  });
};

export const updateProveedor = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ProveedorUpdateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getProveedorById(propietarioId, id);

  if (input.ruc_cedula) {
    await ensureRucAvailable(propietarioId, input.ruc_cedula, id);
  }

  return prisma.proveedor.update({
    where: { id },
    data: input
  });
};

export const updateEstadoProveedor = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ProveedorEstadoInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getProveedorById(propietarioId, id);

  return prisma.proveedor.update({
    where: { id },
    data: {
      activo: input.activo
    }
  });
};

export const deactivateProveedor = async (propietarioIdInput: unknown, idInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getProveedorById(propietarioId, id);

  if (current.activo) {
    return prisma.proveedor.update({
      where: { id },
      data: { activo: false }
    });
  }

  const viajes = await prisma.viajeProveedor.count({
    where: {
      propietario_id: propietarioId,
      proveedor_id: id
    }
  });

  if (viajes > 0) {
    throw new AppError('El proveedor ya esta usado en algunos viajes', 409);
  }

  await prisma.proveedor.delete({ where: { id } });

  return current;
};
