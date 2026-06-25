import { EstadoSuscripcionPropietario, EstadoVehiculo, Prisma } from '@prisma/client';
import type { JwtPayload } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import { resolveReadScopeFromUserOrPropietarioId } from '../../utils/ownership-scope.js';
import { buildPaginatedResult, parsePagination } from '../../utils/pagination.js';
import { toPrismaEstadoVehiculo } from './vehiculos.mapper.js';
import type {
  VehiculoCreateInput,
  VehiculoEstadoInput,
  VehiculoUpdateInput
} from './vehiculos.schema.js';

interface ListVehiculosFilters {
  search?: unknown;
  estado?: unknown;
  categoria_peaje_id?: unknown;
}

const includeCategoria = {
  categoria_peaje: true
} satisfies Prisma.VehiculoInclude;

const buildWhere = (
  scopeInput: JwtPayload | unknown,
  filters: ListVehiculosFilters
): Prisma.VehiculoWhereInput => {
  const scope = resolveReadScopeFromUserOrPropietarioId(scopeInput);
  const where: Prisma.VehiculoWhereInput = scope.all
    ? {}
    : {
        propietario_id: scope.propietarioId
      };

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { placa: { contains: search, mode: 'insensitive' } },
      { marca: { contains: search, mode: 'insensitive' } },
      { modelo: { contains: search, mode: 'insensitive' } },
      { color: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (
    filters.estado === 'disponible' ||
    filters.estado === 'en_viaje' ||
    filters.estado === 'en_mantenimiento' ||
    filters.estado === 'inactivo'
  ) {
    where.estado = toPrismaEstadoVehiculo(filters.estado);
  }

  if (filters.categoria_peaje_id) {
    where.categoria_peaje_id = parseBigIntId(
      filters.categoria_peaje_id,
      'categoria_peaje_id'
    );
  }

  return where;
};

const ensurePlacaAvailable = async (
  propietarioId: bigint,
  placa: string,
  excludeId?: bigint
) => {
  const existing = await prisma.vehiculo.findUnique({
    where: {
      propietario_id_placa: {
        propietario_id: propietarioId,
        placa
      }
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe un vehiculo con esa placa para este propietario', 409);
  }
};

const ensureCategoriaPeajeVisible = async (
  categoriaPeajeIdInput: unknown
) => {
  const categoriaPeajeId = parseBigIntId(categoriaPeajeIdInput, 'categoria_peaje_id');

  const categoria = await prisma.categoriaPeaje.findFirst({
    where: {
      id: categoriaPeajeId,
      activo: true
    }
  });

  if (!categoria) {
    throw new AppError('Categoria de peaje no encontrada o no disponible', 404);
  }

  return categoriaPeajeId;
};

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

const countsForBilling = (estado: EstadoVehiculo, facturable: boolean) => {
  return facturable && estado !== EstadoVehiculo.INACTIVO;
};

const ensureCanCountVehicle = async (propietarioId: bigint, excludeVehiculoId?: bigint) => {
  const propietario = await prisma.propietario.findUnique({
    where: { id: propietarioId },
    select: {
      activo: true,
      estado_suscripcion: true,
      limite_vehiculos: true
    }
  });

  if (!propietario?.activo) {
    throw new AppError('Propietario no disponible para gestionar vehiculos', 403);
  }

  if (
    propietario.estado_suscripcion === EstadoSuscripcionPropietario.SUSPENDIDA ||
    propietario.estado_suscripcion === EstadoSuscripcionPropietario.CANCELADA
  ) {
    throw new AppError('La suscripcion del propietario no permite agregar vehiculos facturables', 403);
  }

  if (propietario.limite_vehiculos <= 0) {
    return;
  }

  const count = await prisma.vehiculo.count({
    where: {
      propietario_id: propietarioId,
      facturable: true,
      estado: {
        not: EstadoVehiculo.INACTIVO
      },
      ...(excludeVehiculoId ? { id: { not: excludeVehiculoId } } : {})
    }
  });

  if (count >= propietario.limite_vehiculos) {
    throw new AppError(
      `El propietario alcanzo el limite contratado de ${propietario.limite_vehiculos} vehiculos facturables`,
      409
    );
  }
};

export const listVehiculos = async (
  scopeInput: JwtPayload | unknown,
  filters: ListVehiculosFilters
) => {
  const where = buildWhere(scopeInput, filters);
  const orderBy = [
    { estado: 'asc' },
    { placa: 'asc' }
  ] satisfies Prisma.VehiculoOrderByWithRelationInput[];
  const pagination = parsePagination(filters as Record<string, unknown>);

  if (!pagination) {
    return prisma.vehiculo.findMany({
      where,
      include: includeCategoria,
      orderBy
    });
  }

  const [data, total] = await prisma.$transaction([
    prisma.vehiculo.findMany({
      where,
      include: includeCategoria,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit
    }),
    prisma.vehiculo.count({ where })
  ]);

  return buildPaginatedResult(data, total, pagination);
};

export const getVehiculoById = async (scopeInput: JwtPayload | unknown, idInput: unknown) => {
  const scope = resolveReadScopeFromUserOrPropietarioId(scopeInput);
  const id = parseBigIntId(idInput);

  const vehiculo = await prisma.vehiculo.findFirst({
    where: {
      id,
      ...(scope.all ? {} : { propietario_id: scope.propietarioId })
    },
    include: includeCategoria
  });

  if (!vehiculo) {
    throw new AppError('Vehiculo no encontrado', 404);
  }

  return vehiculo;
};

export const createVehiculo = async (
  propietarioIdInput: unknown,
  input: VehiculoCreateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const categoriaPeajeId = await ensureCategoriaPeajeVisible(input.categoria_peaje_id);
  const estado = toPrismaEstadoVehiculo(input.estado) ?? EstadoVehiculo.DISPONIBLE;
  const facturable = input.facturable ?? true;

  await ensurePlacaAvailable(propietarioId, input.placa);
  if (countsForBilling(estado, facturable)) {
    await ensureCanCountVehicle(propietarioId);
  }

  return prisma.vehiculo.create({
    data: {
      propietario_id: propietarioId,
      categoria_peaje_id: categoriaPeajeId,
      placa: input.placa,
      marca: input.marca,
      modelo: input.modelo,
      color: input.color,
      anio: input.anio ?? null,
      capacidad: input.capacidad,
      toneladas: input.toneladas,
      kilometraje_actual: input.kilometraje_actual ?? 0,
      rendimiento_km_galon: input.rendimiento_km_galon,
      estado,
      facturable,
      fecha_alta_facturacion:
        Object.hasOwn(input, 'fecha_alta_facturacion')
          ? toDateOnly(input.fecha_alta_facturacion)
          : facturable
            ? todayDateOnly()
            : null,
      fecha_baja_facturacion:
        Object.hasOwn(input, 'fecha_baja_facturacion')
          ? toDateOnly(input.fecha_baja_facturacion)
          : null
    },
    include: includeCategoria
  });
};

export const updateVehiculo = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: VehiculoUpdateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const current = await getVehiculoById(propietarioId, id);

  if (input.placa) {
    await ensurePlacaAvailable(propietarioId, input.placa, id);
  }

  const categoriaPeajeId = input.categoria_peaje_id
    ? await ensureCategoriaPeajeVisible(input.categoria_peaje_id)
    : undefined;
  const nextEstado = toPrismaEstadoVehiculo(input.estado) ?? current.estado;
  const nextFacturable = Object.hasOwn(input, 'facturable')
    ? Boolean(input.facturable)
    : current.facturable;

  if (
    countsForBilling(nextEstado, nextFacturable) &&
    !countsForBilling(current.estado, current.facturable)
  ) {
    await ensureCanCountVehicle(propietarioId, id);
  }

  return prisma.vehiculo.update({
    where: { id },
    data: {
      categoria_peaje_id: categoriaPeajeId,
      placa: input.placa,
      marca: input.marca,
      modelo: Object.hasOwn(input, 'modelo') ? input.modelo : undefined,
      color: Object.hasOwn(input, 'color') ? input.color : undefined,
      anio: Object.hasOwn(input, 'anio') ? input.anio : undefined,
      capacidad: input.capacidad,
      toneladas: input.toneladas,
      kilometraje_actual: input.kilometraje_actual,
      rendimiento_km_galon: input.rendimiento_km_galon,
      estado: toPrismaEstadoVehiculo(input.estado),
      facturable: Object.hasOwn(input, 'facturable') ? Boolean(input.facturable) : undefined,
      fecha_alta_facturacion: Object.hasOwn(input, 'fecha_alta_facturacion')
        ? toDateOnly(input.fecha_alta_facturacion)
        : nextFacturable && !current.fecha_alta_facturacion
          ? todayDateOnly()
          : undefined,
      fecha_baja_facturacion: Object.hasOwn(input, 'fecha_baja_facturacion')
        ? toDateOnly(input.fecha_baja_facturacion)
        : !nextFacturable && current.facturable
          ? todayDateOnly()
          : undefined
    },
    include: includeCategoria
  });
};

export const updateEstadoVehiculo = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: VehiculoEstadoInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const current = await getVehiculoById(propietarioId, id);
  const nextEstado = toPrismaEstadoVehiculo(input.estado) ?? current.estado;

  if (
    countsForBilling(nextEstado, current.facturable) &&
    !countsForBilling(current.estado, current.facturable)
  ) {
    await ensureCanCountVehicle(propietarioId, id);
  }

  return prisma.vehiculo.update({
    where: { id },
    data: {
      estado: toPrismaEstadoVehiculo(input.estado)
    },
    include: includeCategoria
  });
};

export const deactivateVehiculo = async (propietarioIdInput: unknown, idInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const current = await getVehiculoById(propietarioId, id);

  if (current.estado !== EstadoVehiculo.INACTIVO) {
    return prisma.vehiculo.update({
      where: { id },
      data: {
        estado: EstadoVehiculo.INACTIVO
      },
      include: includeCategoria
    });
  }

  const [viajes, mantenimientos, gastosSemanales, cierresSemanales] = await Promise.all([
    prisma.viaje.count({
      where: {
        propietario_id: propietarioId,
        vehiculo_id: id
      }
    }),
    prisma.mantenimiento.count({
      where: {
        propietario_id: propietarioId,
        vehiculo_id: id
      }
    }),
    prisma.gastoSemanalVehiculo.count({
      where: {
        propietario_id: propietarioId,
        vehiculo_id: id
      }
    }),
    prisma.cierreSemanal.count({
      where: {
        propietario_id: propietarioId,
        vehiculo_id: id
      }
    })
  ]);

  const blockers: string[] = [];
  if (viajes > 0) blockers.push('El vehiculo ya esta usado en algunos viajes');
  if (mantenimientos > 0) blockers.push('El vehiculo ya esta usado en algunos mantenimientos');
  if (gastosSemanales > 0) blockers.push('El vehiculo ya esta usado en gastos semanales');
  if (cierresSemanales > 0) blockers.push('El vehiculo ya esta usado en cierres semanales');

  if (blockers.length) {
    throw new AppError(blockers.join('. '), 409);
  }

  await prisma.vehiculo.delete({
    where: { id }
  });

  return current;
};
