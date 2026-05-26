import { EstadoVehiculo, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
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
  propietarioId: bigint,
  filters: ListVehiculosFilters
): Prisma.VehiculoWhereInput => {
  const where: Prisma.VehiculoWhereInput = {
    propietario_id: propietarioId
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

export const listVehiculos = async (
  propietarioIdInput: unknown,
  filters: ListVehiculosFilters
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');

  return prisma.vehiculo.findMany({
    where: buildWhere(propietarioId, filters),
    include: includeCategoria,
    orderBy: [{ estado: 'asc' }, { placa: 'asc' }]
  });
};

export const getVehiculoById = async (propietarioIdInput: unknown, idInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const vehiculo = await prisma.vehiculo.findFirst({
    where: {
      id,
      propietario_id: propietarioId
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

  await ensurePlacaAvailable(propietarioId, input.placa);

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
      estado: toPrismaEstadoVehiculo(input.estado) ?? EstadoVehiculo.DISPONIBLE
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

  await getVehiculoById(propietarioId, id);

  if (input.placa) {
    await ensurePlacaAvailable(propietarioId, input.placa, id);
  }

  const categoriaPeajeId = input.categoria_peaje_id
    ? await ensureCategoriaPeajeVisible(input.categoria_peaje_id)
    : undefined;

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
      estado: toPrismaEstadoVehiculo(input.estado)
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

  await getVehiculoById(propietarioId, id);

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

  await getVehiculoById(propietarioId, id);

  return prisma.vehiculo.update({
    where: { id },
    data: {
      estado: EstadoVehiculo.INACTIVO
    },
    include: includeCategoria
  });
};
