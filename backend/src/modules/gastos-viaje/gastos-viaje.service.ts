import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import type { GastoViajeCreateInput, GastoViajeUpdateInput } from './gastos-viaje.schema.js';

interface ListFilters {
  tipo_gasto_id?: unknown;
  es_estimado?: unknown;
  fecha_desde?: unknown;
  fecha_hasta?: unknown;
}

const includeRelations = {
  tipo_gasto: true,
  viaje: {
    select: {
      id: true,
      propietario_id: true,
      fecha_salida: true,
      costo_diesel: true,
      costo_peajes: true,
      costo_estimado_gastos: true,
      costo_real_gastos: true
    }
  }
} satisfies Prisma.GastoViajeInclude;

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
};

const parseDateFilter = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !dateOnlyPattern.test(value)) {
    throw new AppError(`${field} debe tener formato YYYY-MM-DD`, 400);
  }

  return toDateOnly(value)!;
};

const toMoney = (value: number | string | Prisma.Decimal) => {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
};

const buildWhere = (viajeId: bigint, filters: ListFilters): Prisma.GastoViajeWhereInput => {
  const where: Prisma.GastoViajeWhereInput = {
    viaje_id: viajeId
  };

  if (filters.tipo_gasto_id) {
    where.tipo_gasto_id = parseBigIntId(filters.tipo_gasto_id, 'tipo_gasto_id');
  }

  if (filters.es_estimado === 'true') where.es_estimado = true;
  if (filters.es_estimado === 'false') where.es_estimado = false;

  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha_gasto = {};

    if (filters.fecha_desde) {
      where.fecha_gasto.gte = parseDateFilter(filters.fecha_desde, 'fecha_desde');
    }

    if (filters.fecha_hasta) {
      where.fecha_gasto.lte = parseDateFilter(filters.fecha_hasta, 'fecha_hasta');
    }
  }

  return where;
};

const getViajeForWrite = async (propietarioId: bigint, viajeId: bigint) => {
  const viaje = await prisma.viaje.findFirst({
    where: {
      id: viajeId,
      propietario_id: propietarioId
    }
  });

  if (!viaje) {
    throw new AppError('Viaje no encontrado', 404);
  }

  return viaje;
};

const ensureTipoGastoAvailable = async (tipoGastoId: bigint) => {
  const tipoGasto = await prisma.tipoGastoViaje.findFirst({
    where: {
      id: tipoGastoId,
      activo: true
    }
  });

  if (!tipoGasto) {
    throw new AppError('Tipo de gasto de viaje no encontrado o no disponible', 404);
  }
};

const recalculateCostoEstimadoGastos = async (
  tx: Prisma.TransactionClient,
  viajeId: bigint
) => {
  const viaje = await tx.viaje.findUnique({
    where: { id: viajeId },
    select: {
      costo_diesel: true,
      costo_peajes: true
    }
  });

  if (!viaje) {
    throw new AppError('Viaje no encontrado', 404);
  }

  const estimados = await tx.gastoViaje.aggregate({
    where: {
      viaje_id: viajeId,
      es_estimado: true
    },
    _sum: {
      monto: true
    }
  });

  const total = toMoney(viaje.costo_diesel)
    .plus(toMoney(viaje.costo_peajes))
    .plus(toMoney(estimados._sum.monto ?? 0))
    .toDecimalPlaces(2);

  await tx.viaje.update({
    where: { id: viajeId },
    data: {
      costo_estimado_gastos: total
    }
  });
};

export const listGastosViaje = async (
  propietarioIdInput: unknown,
  viajeIdInput: unknown,
  filters: ListFilters
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const viajeId = parseBigIntId(viajeIdInput, 'viaje_id');

  await getViajeForWrite(propietarioId, viajeId);

  return prisma.gastoViaje.findMany({
    where: buildWhere(viajeId, filters),
    include: includeRelations,
    orderBy: [{ fecha_gasto: 'asc' }, { id: 'asc' }]
  });
};

export const getGastoViajeById = async (
  propietarioIdInput: unknown,
  viajeIdInput: unknown,
  idInput: unknown
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const viajeId = parseBigIntId(viajeIdInput, 'viaje_id');
  const id = parseBigIntId(idInput);

  const gasto = await prisma.gastoViaje.findFirst({
    where: {
      id,
      viaje_id: viajeId,
      viaje: {
        propietario_id: propietarioId
      }
    },
    include: includeRelations
  });

  if (!gasto) {
    throw new AppError('Gasto de viaje no encontrado', 404);
  }

  return gasto;
};

export const createGastoViaje = async (
  propietarioIdInput: unknown,
  viajeIdInput: unknown,
  input: GastoViajeCreateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const viajeId = parseBigIntId(viajeIdInput, 'viaje_id');
  const tipoGastoId = parseBigIntId(input.tipo_gasto_id, 'tipo_gasto_id');
  const viaje = await getViajeForWrite(propietarioId, viajeId);

  await ensureTipoGastoAvailable(tipoGastoId);

  return prisma.$transaction(async (tx) => {
    const gasto = await tx.gastoViaje.create({
      data: {
        viaje_id: viajeId,
        tipo_gasto_id: tipoGastoId,
        descripcion: input.descripcion,
        monto: toMoney(input.monto),
        fecha_gasto: toDateOnly(input.fecha_gasto) ?? viaje.fecha_salida,
        es_estimado: input.es_estimado ?? true
      }
    });

    await recalculateCostoEstimadoGastos(tx, viajeId);

    return tx.gastoViaje.findUniqueOrThrow({
      where: { id: gasto.id },
      include: includeRelations
    });
  });
};

export const updateGastoViaje = async (
  propietarioIdInput: unknown,
  viajeIdInput: unknown,
  idInput: unknown,
  input: GastoViajeUpdateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const viajeId = parseBigIntId(viajeIdInput, 'viaje_id');
  const id = parseBigIntId(idInput);
  const current = await getGastoViajeById(propietarioId, viajeId, id);
  const tipoGastoId = input.tipo_gasto_id
    ? parseBigIntId(input.tipo_gasto_id, 'tipo_gasto_id')
    : current.tipo_gasto_id;

  if (input.tipo_gasto_id) {
    await ensureTipoGastoAvailable(tipoGastoId);
  }

  return prisma.$transaction(async (tx) => {
    const gasto = await tx.gastoViaje.update({
      where: { id },
      data: {
        tipo_gasto_id: input.tipo_gasto_id ? tipoGastoId : undefined,
        descripcion: Object.hasOwn(input, 'descripcion') ? input.descripcion : undefined,
        monto: input.monto !== undefined ? toMoney(input.monto) : undefined,
        fecha_gasto: Object.hasOwn(input, 'fecha_gasto')
          ? toDateOnly(input.fecha_gasto) ?? current.viaje.fecha_salida
          : undefined,
        es_estimado: input.es_estimado
      }
    });

    await recalculateCostoEstimadoGastos(tx, viajeId);

    return tx.gastoViaje.findUniqueOrThrow({
      where: { id: gasto.id },
      include: includeRelations
    });
  });
};

export const deleteGastoViaje = async (
  propietarioIdInput: unknown,
  viajeIdInput: unknown,
  idInput: unknown
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const viajeId = parseBigIntId(viajeIdInput, 'viaje_id');
  const id = parseBigIntId(idInput);

  await getGastoViajeById(propietarioId, viajeId, id);

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.gastoViaje.delete({
      where: { id },
      include: includeRelations
    });

    await recalculateCostoEstimadoGastos(tx, viajeId);

    return deleted;
  });
};
