import { Prisma } from '@prisma/client';
import type { JwtPayload } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import { resolveReadScopeFromUserOrPropietarioId } from '../../utils/ownership-scope.js';
import { buildPaginatedResult, parsePagination } from '../../utils/pagination.js';
import type {
  ClienteCreateInput,
  ClienteEstadoInput,
  ClienteUpdateInput
} from './clientes.schema.js';

interface ListClientesFilters {
  search?: unknown;
  activo?: unknown;
}

const buildWhere = (
  scopeInput: JwtPayload | unknown,
  filters: ListClientesFilters
): Prisma.ClienteWhereInput => {
  const scope = resolveReadScopeFromUserOrPropietarioId(scopeInput);
  const where: Prisma.ClienteWhereInput = scope.all
    ? {}
    : {
        propietario_id: scope.propietarioId
      };

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { ruc_cedula: { contains: search, mode: 'insensitive' } },
      { contacto_nombre: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (filters.activo === 'true') {
    where.activo = true;
  }

  if (filters.activo === 'false') {
    where.activo = false;
  }

  return where;
};

const ensureRucAvailable = async (
  propietarioId: bigint,
  rucCedula: string,
  excludeId?: bigint
) => {
  const existing = await prisma.cliente.findUnique({
    where: {
      propietario_id_ruc_cedula: {
        propietario_id: propietarioId,
        ruc_cedula: rucCedula
      }
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe un cliente con ese RUC/cedula para este propietario', 409);
  }
};

export const listClientes = async (
  scopeInput: JwtPayload | unknown,
  filters: ListClientesFilters
) => {
  const where = buildWhere(scopeInput, filters);
  const orderBy = [
    { activo: 'desc' },
    { nombre: 'asc' }
  ] satisfies Prisma.ClienteOrderByWithRelationInput[];
  const pagination = parsePagination(filters as Record<string, unknown>);

  if (!pagination) {
    return prisma.cliente.findMany({
      where,
      orderBy
    });
  }

  const [data, total] = await prisma.$transaction([
    prisma.cliente.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit
    }),
    prisma.cliente.count({ where })
  ]);

  return buildPaginatedResult(data, total, pagination);
};

export const getClienteById = async (scopeInput: JwtPayload | unknown, idInput: unknown) => {
  const scope = resolveReadScopeFromUserOrPropietarioId(scopeInput);
  const id = parseBigIntId(idInput);

  const cliente = await prisma.cliente.findFirst({
    where: {
      id,
      ...(scope.all ? {} : { propietario_id: scope.propietarioId })
    }
  });

  if (!cliente) {
    throw new AppError('Cliente no encontrado', 404);
  }

  return cliente;
};

export const createCliente = async (
  propietarioIdInput: unknown,
  input: ClienteCreateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');

  await ensureRucAvailable(propietarioId, input.ruc_cedula);

  return prisma.cliente.create({
    data: {
      propietario_id: propietarioId,
      nombre: input.nombre,
      ruc_cedula: input.ruc_cedula,
      contacto_nombre: input.contacto_nombre,
      telefono: input.telefono,
      email: input.email,
      direccion: input.direccion,
      porcentaje_comision: input.porcentaje_comision ?? 0,
      activo: input.activo ?? true
    }
  });
};

export const updateCliente = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ClienteUpdateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getClienteById(propietarioId, id);

  if (input.ruc_cedula) {
    await ensureRucAvailable(propietarioId, input.ruc_cedula, id);
  }

  return prisma.cliente.update({
    where: { id },
    data: input
  });
};

export const updateEstadoCliente = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ClienteEstadoInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getClienteById(propietarioId, id);

  return prisma.cliente.update({
    where: { id },
    data: {
      activo: input.activo
    }
  });
};

export const deactivateCliente = async (propietarioIdInput: unknown, idInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const current = await getClienteById(propietarioId, id);

  if (current.activo) {
    return prisma.cliente.update({
      where: { id },
      data: {
        activo: false
      }
    });
  }

  const [viajes, viajesProveedor] = await Promise.all([
    prisma.viaje.count({
      where: {
        propietario_id: propietarioId,
        cliente_id: id
      }
    }),
    prisma.viajeProveedor.count({
      where: {
        propietario_id: propietarioId,
        cliente_id: id
      }
    })
  ]);

  if (viajes > 0 || viajesProveedor > 0) {
    throw new AppError('El cliente ya esta usado en algunos viajes', 409);
  }

  await prisma.cliente.delete({
    where: { id }
  });

  return current;
};
