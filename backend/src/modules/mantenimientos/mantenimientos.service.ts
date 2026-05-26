import { EstadoMantenimiento, EstadoVehiculo, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import { toPrismaEstadoMantenimiento } from './mantenimientos.mapper.js';
import type {
  MantenimientoCreateInput,
  MantenimientoEstadoInput,
  MantenimientoUpdateInput
} from './mantenimientos.schema.js';

interface ListFilters {
  vehiculo_id?: unknown;
  tipo_mantenimiento_id?: unknown;
  estado?: unknown;
  fecha_desde?: unknown;
  fecha_hasta?: unknown;
  search?: unknown;
}

type RepuestoInput = NonNullable<MantenimientoCreateInput['repuestos']>[number];

const includeRelations = {
  vehiculo: {
    include: {
      categoria_peaje: true
    }
  },
  tipo_mantenimiento: true,
  repuestos: {
    orderBy: { id: 'asc' }
  }
} satisfies Prisma.MantenimientoInclude;

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
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

const buildWhere = (
  propietarioId: bigint,
  filters: ListFilters
): Prisma.MantenimientoWhereInput => {
  const where: Prisma.MantenimientoWhereInput = {
    propietario_id: propietarioId
  };

  if (filters.vehiculo_id) {
    where.vehiculo_id = parseBigIntId(filters.vehiculo_id, 'vehiculo_id');
  }

  if (filters.tipo_mantenimiento_id) {
    where.tipo_mantenimiento_id = parseBigIntId(
      filters.tipo_mantenimiento_id,
      'tipo_mantenimiento_id'
    );
  }

  if (
    filters.estado === 'programado' ||
    filters.estado === 'realizado' ||
    filters.estado === 'cancelado' ||
    filters.estado === 'vencido'
  ) {
    where.estado = toPrismaEstadoMantenimiento(filters.estado);
  }

  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha_mantenimiento = {};

    if (filters.fecha_desde) {
      where.fecha_mantenimiento.gte = parseDateFilter(filters.fecha_desde, 'fecha_desde');
    }

    if (filters.fecha_hasta) {
      where.fecha_mantenimiento.lte = parseDateFilter(filters.fecha_hasta, 'fecha_hasta');
    }
  }

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.AND = [
      {
        OR: [
          { descripcion: { contains: search, mode: 'insensitive' } },
          { vehiculo: { placa: { contains: search, mode: 'insensitive' } } },
          { tipo_mantenimiento: { nombre: { contains: search, mode: 'insensitive' } } },
          { repuestos: { some: { nombre_repuesto: { contains: search, mode: 'insensitive' } } } }
        ]
      }
    ];
  }

  return where;
};

const ensureVehiculoAvailable = async (propietarioId: bigint, vehiculoId: bigint) => {
  const vehiculo = await prisma.vehiculo.findFirst({
    where: {
      id: vehiculoId,
      propietario_id: propietarioId,
      estado: {
        not: EstadoVehiculo.INACTIVO
      }
    }
  });

  if (!vehiculo) {
    throw new AppError('Vehiculo no encontrado o no disponible', 404);
  }

  return vehiculo;
};

const ensureTipoMantenimientoVisible = async (
  propietarioId: bigint,
  tipoMantenimientoId: bigint
) => {
  const tipoMantenimiento = await prisma.tipoMantenimiento.findFirst({
    where: {
      id: tipoMantenimientoId,
      activo: true,
      OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
    }
  });

  if (!tipoMantenimiento) {
    throw new AppError('Tipo de mantenimiento no encontrado o no disponible', 404);
  }

  return tipoMantenimiento;
};

const buildRepuestos = (repuestos: RepuestoInput[] = []) => {
  return repuestos.map((repuesto) => {
    const cantidad = new Prisma.Decimal(repuesto.cantidad ?? 1).toDecimalPlaces(2);
    const costoUnitario = toMoney(repuesto.costo_unitario);

    return {
      nombre_repuesto: repuesto.nombre_repuesto,
      cantidad,
      costo_unitario: costoUnitario,
      costo_total: cantidad.mul(costoUnitario).toDecimalPlaces(2)
    };
  });
};

const sumRepuestos = (repuestos: ReturnType<typeof buildRepuestos>) => {
  return repuestos
    .reduce((total, repuesto) => total.plus(repuesto.costo_total), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
};

const resolveProximoKm = (
  explicitValue: number | null | undefined,
  hasExplicitValue: boolean,
  tipoMantenimiento: { intervalo_km: number | null },
  kilometrajeActual: number,
  currentValue?: number | null
) => {
  if (hasExplicitValue) {
    return explicitValue ?? null;
  }

  if (currentValue !== undefined) {
    return currentValue;
  }

  return tipoMantenimiento.intervalo_km
    ? kilometrajeActual + tipoMantenimiento.intervalo_km
    : null;
};

const resolveProximoFecha = (
  explicitValue: string | null | undefined,
  hasExplicitValue: boolean,
  tipoMantenimiento: { intervalo_dias: number | null },
  fechaMantenimiento: Date,
  currentValue?: Date | null
) => {
  if (hasExplicitValue) {
    return toDateOnly(explicitValue);
  }

  if (currentValue !== undefined) {
    return currentValue;
  }

  return tipoMantenimiento.intervalo_dias
    ? addDays(fechaMantenimiento, tipoMantenimiento.intervalo_dias)
    : null;
};

const updateVehiculoKilometrajeIfNeeded = async (
  tx: Prisma.TransactionClient,
  propietarioId: bigint,
  vehiculoId: bigint,
  kilometrajeActualVehiculo: number,
  shouldUpdate: boolean
) => {
  if (!shouldUpdate) return;

  await tx.vehiculo.updateMany({
    where: {
      id: vehiculoId,
      propietario_id: propietarioId,
      kilometraje_actual: {
        lt: kilometrajeActualVehiculo
      }
    },
    data: {
      kilometraje_actual: kilometrajeActualVehiculo
    }
  });
};

export const listMantenimientos = async (
  propietarioIdInput: unknown,
  filters: ListFilters
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');

  return prisma.mantenimiento.findMany({
    where: buildWhere(propietarioId, filters),
    include: includeRelations,
    orderBy: [{ fecha_mantenimiento: 'desc' }, { id: 'desc' }]
  });
};

export const getMantenimientoById = async (
  propietarioIdInput: unknown,
  idInput: unknown
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const mantenimiento = await prisma.mantenimiento.findFirst({
    where: {
      id,
      propietario_id: propietarioId
    },
    include: includeRelations
  });

  if (!mantenimiento) {
    throw new AppError('Mantenimiento no encontrado', 404);
  }

  return mantenimiento;
};

export const createMantenimiento = async (
  propietarioIdInput: unknown,
  input: MantenimientoCreateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const vehiculoId = parseBigIntId(input.vehiculo_id, 'vehiculo_id');
  const tipoMantenimientoId = parseBigIntId(
    input.tipo_mantenimiento_id,
    'tipo_mantenimiento_id'
  );
  const [vehiculo, tipoMantenimiento] = await Promise.all([
    ensureVehiculoAvailable(propietarioId, vehiculoId),
    ensureTipoMantenimientoVisible(propietarioId, tipoMantenimientoId)
  ]);
  const fechaMantenimiento = toDateOnly(input.fecha_mantenimiento) ?? todayDateOnly();
  const kilometrajeActualVehiculo =
    input.kilometraje_actual_vehiculo ?? vehiculo.kilometraje_actual;
  const repuestos = buildRepuestos(input.repuestos);
  const costoManoObra = toMoney(input.costo_mano_obra ?? 0);
  const costoRepuestos = input.repuestos
    ? sumRepuestos(repuestos)
    : toMoney(input.costo_repuestos ?? 0);
  const costoTotal = costoManoObra.plus(costoRepuestos).toDecimalPlaces(2);
  const proximoMantenimientoKm = resolveProximoKm(
    input.proximo_mantenimiento_km,
    Object.hasOwn(input, 'proximo_mantenimiento_km'),
    tipoMantenimiento,
    kilometrajeActualVehiculo
  );
  const proximoMantenimientoFecha = resolveProximoFecha(
    input.proximo_mantenimiento_fecha,
    Object.hasOwn(input, 'proximo_mantenimiento_fecha'),
    tipoMantenimiento,
    fechaMantenimiento
  );
  const shouldUpdateKilometraje = input.actualizar_kilometraje_vehiculo ?? true;

  return prisma.$transaction(async (tx) => {
    const mantenimiento = await tx.mantenimiento.create({
      data: {
        propietario_id: propietarioId,
        vehiculo_id: vehiculoId,
        tipo_mantenimiento_id: tipoMantenimientoId,
        fecha_mantenimiento: fechaMantenimiento,
        kilometraje_actual_vehiculo: kilometrajeActualVehiculo,
        descripcion: input.descripcion,
        costo_mano_obra: costoManoObra,
        costo_repuestos: costoRepuestos,
        costo_total: costoTotal,
        proximo_mantenimiento_km: proximoMantenimientoKm,
        proximo_mantenimiento_fecha: proximoMantenimientoFecha,
        estado: toPrismaEstadoMantenimiento(input.estado) ?? EstadoMantenimiento.REALIZADO
      }
    });

    if (repuestos.length) {
      await tx.repuestoMantenimiento.createMany({
        data: repuestos.map((repuesto) => ({
          mantenimiento_id: mantenimiento.id,
          ...repuesto
        }))
      });
    }

    await updateVehiculoKilometrajeIfNeeded(
      tx,
      propietarioId,
      vehiculoId,
      kilometrajeActualVehiculo,
      shouldUpdateKilometraje
    );

    return tx.mantenimiento.findUniqueOrThrow({
      where: { id: mantenimiento.id },
      include: includeRelations
    });
  });
};

export const updateMantenimiento = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: MantenimientoUpdateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getMantenimientoById(propietarioId, id);
  const vehiculoId = input.vehiculo_id
    ? parseBigIntId(input.vehiculo_id, 'vehiculo_id')
    : current.vehiculo_id;
  const tipoMantenimientoId = input.tipo_mantenimiento_id
    ? parseBigIntId(input.tipo_mantenimiento_id, 'tipo_mantenimiento_id')
    : current.tipo_mantenimiento_id;

  const vehiculo = input.vehiculo_id
    ? await ensureVehiculoAvailable(propietarioId, vehiculoId)
    : current.vehiculo;
  const tipoMantenimiento = input.tipo_mantenimiento_id
    ? await ensureTipoMantenimientoVisible(propietarioId, tipoMantenimientoId)
    : current.tipo_mantenimiento;
  const fechaMantenimiento = input.fecha_mantenimiento
    ? toDateOnly(input.fecha_mantenimiento)!
    : current.fecha_mantenimiento;
  const kilometrajeActualVehiculo =
    input.kilometraje_actual_vehiculo ?? current.kilometraje_actual_vehiculo;
  const repuestos = input.repuestos ? buildRepuestos(input.repuestos) : null;
  const costoManoObra =
    input.costo_mano_obra !== undefined
      ? toMoney(input.costo_mano_obra)
      : current.costo_mano_obra;
  const costoRepuestos = repuestos
    ? sumRepuestos(repuestos)
    : input.costo_repuestos !== undefined
      ? toMoney(input.costo_repuestos)
      : current.costo_repuestos;
  const costoTotal = costoManoObra.plus(costoRepuestos).toDecimalPlaces(2);
  const shouldRecalculateProximoKm =
    Object.hasOwn(input, 'tipo_mantenimiento_id') ||
    Object.hasOwn(input, 'kilometraje_actual_vehiculo');
  const shouldRecalculateProximoFecha =
    Object.hasOwn(input, 'tipo_mantenimiento_id') ||
    Object.hasOwn(input, 'fecha_mantenimiento');
  const proximoMantenimientoKm = resolveProximoKm(
    input.proximo_mantenimiento_km,
    Object.hasOwn(input, 'proximo_mantenimiento_km'),
    tipoMantenimiento,
    kilometrajeActualVehiculo,
    shouldRecalculateProximoKm ? undefined : current.proximo_mantenimiento_km
  );
  const proximoMantenimientoFecha = resolveProximoFecha(
    input.proximo_mantenimiento_fecha,
    Object.hasOwn(input, 'proximo_mantenimiento_fecha'),
    tipoMantenimiento,
    fechaMantenimiento,
    shouldRecalculateProximoFecha ? undefined : current.proximo_mantenimiento_fecha
  );
  const shouldUpdateKilometraje =
    input.actualizar_kilometraje_vehiculo ??
    (Object.hasOwn(input, 'kilometraje_actual_vehiculo') ||
      Object.hasOwn(input, 'vehiculo_id'));

  return prisma.$transaction(async (tx) => {
    const mantenimiento = await tx.mantenimiento.update({
      where: { id },
      data: {
        vehiculo_id: input.vehiculo_id ? vehiculoId : undefined,
        tipo_mantenimiento_id: input.tipo_mantenimiento_id ? tipoMantenimientoId : undefined,
        fecha_mantenimiento: input.fecha_mantenimiento ? fechaMantenimiento : undefined,
        kilometraje_actual_vehiculo: input.kilometraje_actual_vehiculo,
        descripcion: Object.hasOwn(input, 'descripcion') ? input.descripcion : undefined,
        costo_mano_obra: input.costo_mano_obra !== undefined ? costoManoObra : undefined,
        costo_repuestos:
          input.repuestos || input.costo_repuestos !== undefined ? costoRepuestos : undefined,
        costo_total:
          input.repuestos ||
          input.costo_mano_obra !== undefined ||
          input.costo_repuestos !== undefined
            ? costoTotal
            : undefined,
        proximo_mantenimiento_km:
          Object.hasOwn(input, 'proximo_mantenimiento_km') || shouldRecalculateProximoKm
            ? proximoMantenimientoKm
            : undefined,
        proximo_mantenimiento_fecha:
          Object.hasOwn(input, 'proximo_mantenimiento_fecha') || shouldRecalculateProximoFecha
            ? proximoMantenimientoFecha
            : undefined,
        estado: toPrismaEstadoMantenimiento(input.estado)
      }
    });

    if (repuestos) {
      await tx.repuestoMantenimiento.deleteMany({
        where: { mantenimiento_id: id }
      });

      if (repuestos.length) {
        await tx.repuestoMantenimiento.createMany({
          data: repuestos.map((repuesto) => ({
            mantenimiento_id: id,
            ...repuesto
          }))
        });
      }
    }

    await updateVehiculoKilometrajeIfNeeded(
      tx,
      propietarioId,
      vehiculo.id,
      kilometrajeActualVehiculo,
      shouldUpdateKilometraje
    );

    return tx.mantenimiento.findUniqueOrThrow({
      where: { id: mantenimiento.id },
      include: includeRelations
    });
  });
};

export const updateEstadoMantenimiento = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: MantenimientoEstadoInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getMantenimientoById(propietarioId, id);

  return prisma.mantenimiento.update({
    where: { id },
    data: {
      estado: toPrismaEstadoMantenimiento(input.estado)
    },
    include: includeRelations
  });
};

export const cancelMantenimiento = async (
  propietarioIdInput: unknown,
  idInput: unknown
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getMantenimientoById(propietarioId, id);

  return prisma.mantenimiento.update({
    where: { id },
    data: {
      estado: EstadoMantenimiento.CANCELADO
    },
    include: includeRelations
  });
};
