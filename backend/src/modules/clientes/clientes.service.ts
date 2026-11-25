import { Prisma } from '@prisma/client';
import type { JwtPayload } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import { resolveReadScopeWithOwnOverride } from '../../utils/ownership-scope.js';
import { buildPaginatedResult, parsePagination } from '../../utils/pagination.js';
import type {
  ClienteCreateInput,
  ClienteEstadoInput,
  ClienteUpdateInput
} from './clientes.schema.js';

interface ListClientesFilters {
  search?: unknown;
  activo?: unknown;
  solo_propios?: unknown;
}

const includePropietario = {
  configuracion_facturacion: true,
  propietario: {
    select: {
      id: true,
      nombre: true
    }
  }
} satisfies Prisma.ClienteInclude;

const formatCliente = <T extends Prisma.ClienteGetPayload<{ include: typeof includePropietario }>>(cliente: T) => {
  const config = cliente.configuracion_facturacion;
  const modalidad = config?.modalidad_comision ?? (/TRANSPALFRA/i.test(cliente.nombre) ? 'EN_FACTURA' : 'AL_PAGAR');
  return {
    ...cliente,
    modalidad_comision: modalidad,
    modalidad_comision_nombre: modalidad === 'EN_FACTURA' ? 'En factura' : 'Al pagar',
    ir_facturacion: config?.ir_empresa ?? true
  };
};

const buildWhere = (
  scopeInput: JwtPayload | unknown,
  filters: ListClientesFilters
): Prisma.ClienteWhereInput => {
  const scope = resolveReadScopeWithOwnOverride(
    scopeInput,
    filters.solo_propios === 'true' || filters.solo_propios === true
  );
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
    const rows = await prisma.cliente.findMany({
      where,
      include: includePropietario,
      orderBy
    });
    return rows.map(formatCliente);
  }

  const [data, total] = await prisma.$transaction([
    prisma.cliente.findMany({
      where,
      include: includePropietario,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit
    }),
    prisma.cliente.count({ where })
  ]);

  return buildPaginatedResult(data.map(formatCliente), total, pagination);
};

export const getClienteById = async (scopeInput: JwtPayload | unknown, idInput: unknown) => {
  const scope = resolveReadScopeWithOwnOverride(scopeInput, false);
  const id = parseBigIntId(idInput);

  const cliente = await prisma.cliente.findFirst({
    where: {
      id,
      ...(scope.all ? {} : { propietario_id: scope.propietarioId })
    },
    include: includePropietario
  });

  if (!cliente) {
    throw new AppError('Cliente no encontrado', 404);
  }

  return formatCliente(cliente);
};

export const createCliente = async (
  propietarioIdInput: unknown,
  input: ClienteCreateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');

  await ensureRucAvailable(propietarioId, input.ruc_cedula);

  const cliente = await prisma.cliente.create({
    data: {
      propietario_id: propietarioId,
      nombre: input.nombre,
      ruc_cedula: input.ruc_cedula,
      contacto_nombre: input.contacto_nombre,
      telefono: input.telefono,
      email: input.email,
      direccion: input.direccion,
      porcentaje_comision: input.porcentaje_comision ?? 0,
      activo: input.activo ?? true,
      configuracion_facturacion: { create: {
        propietario_id: propietarioId,
        modalidad_comision: input.modalidad_comision ?? 'AL_PAGAR',
        ir_empresa: input.ir_facturacion ?? true
      } }
    },
    include: includePropietario
  });
  return formatCliente(cliente);
};

export const updateCliente = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ClienteUpdateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const current = await getClienteById(propietarioId, id);

  if (input.ruc_cedula) {
    await ensureRucAvailable(propietarioId, input.ruc_cedula, id);
  }

  const { modalidad_comision, ir_facturacion, ...data } = input;
  const billingChanged = modalidad_comision !== undefined || ir_facturacion !== undefined;
  const cliente = await prisma.cliente.update({
    where: { id },
    data: {
      ...data,
      ...(billingChanged ? { configuracion_facturacion: { upsert: {
        create: {
          propietario_id: propietarioId,
          modalidad_comision: modalidad_comision ?? current.modalidad_comision,
          ir_empresa: ir_facturacion ?? current.ir_facturacion
        },
        update: { modalidad_comision, ir_empresa: ir_facturacion }
      } } } : {})
    },
    include: includePropietario
  });
  return formatCliente(cliente);
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

  await prisma.$transaction(async tx => {
    const [facturas, destinatarios, propios, externos] = await Promise.all([
      tx.facturaTransporte.count({ where: { destinatario_id: id } }),
      tx.configuracionFacturacion.count({ where: { destinatario_id: id, cliente_id: { not: id } } }),
      tx.viaje.count({ where: { facturar_a_id: id } }),
      tx.viajeProveedor.count({ where: { facturar_a_id: id } })
    ]);
    if (facturas || destinatarios || propios || externos) {
      throw new AppError('El cliente está asociado a facturación o se usa como destinatario de otros registros.', 409);
    }
    await tx.configuracionFacturacion.deleteMany({ where: { cliente_id: id, propietario_id: propietarioId } });
    await tx.cliente.delete({ where: { id } });
  });

  return current;
};
