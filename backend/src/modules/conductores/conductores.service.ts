import { EstadoConductor, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import { toPrismaEstadoConductor } from './conductores.mapper.js';
import type {
  ConductorCreateInput,
  ConductorEstadoInput,
  ConductorUpdateInput
} from './conductores.schema.js';

interface ListConductoresFilters {
  search?: unknown;
  estado?: unknown;
  licencia_vencida?: unknown;
}

const toDateOnly = (value?: string | null) => {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
};

const buildWhere = (
  propietarioId: bigint,
  filters: ListConductoresFilters
): Prisma.ConductorWhereInput => {
  const where: Prisma.ConductorWhereInput = {
    propietario_id: propietarioId
  };

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { cedula: { contains: search, mode: 'insensitive' } },
      { numero_licencia: { contains: search, mode: 'insensitive' } },
      { telefono: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (
    filters.estado === 'activo' ||
    filters.estado === 'inactivo' ||
    filters.estado === 'licencia_vencida'
  ) {
    where.estado = toPrismaEstadoConductor(filters.estado);
  }

  if (filters.licencia_vencida === 'true') {
    where.fecha_caducidad_licencia = {
      lt: new Date()
    };
  }

  return where;
};

const ensureCedulaAvailable = async (
  propietarioId: bigint,
  cedula: string,
  excludeId?: bigint
) => {
  const existing = await prisma.conductor.findUnique({
    where: {
      propietario_id_cedula: {
        propietario_id: propietarioId,
        cedula
      }
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe un conductor con esa cedula para este propietario', 409);
  }
};

const ensureLicenciaAvailable = async (
  propietarioId: bigint,
  numeroLicencia: string,
  excludeId?: bigint
) => {
  const existing = await prisma.conductor.findUnique({
    where: {
      propietario_id_numero_licencia: {
        propietario_id: propietarioId,
        numero_licencia: numeroLicencia
      }
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe un conductor con esa licencia para este propietario', 409);
  }
};

export const listConductores = async (
  propietarioIdInput: unknown,
  filters: ListConductoresFilters
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');

  return prisma.conductor.findMany({
    where: buildWhere(propietarioId, filters),
    orderBy: [{ estado: 'asc' }, { nombre: 'asc' }]
  });
};

export const getConductorById = async (propietarioIdInput: unknown, idInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const conductor = await prisma.conductor.findFirst({
    where: {
      id,
      propietario_id: propietarioId
    }
  });

  if (!conductor) {
    throw new AppError('Conductor no encontrado', 404);
  }

  return conductor;
};

export const createConductor = async (
  propietarioIdInput: unknown,
  input: ConductorCreateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');

  await ensureCedulaAvailable(propietarioId, input.cedula);
  await ensureLicenciaAvailable(propietarioId, input.numero_licencia);

  return prisma.conductor.create({
    data: {
      propietario_id: propietarioId,
      nombre: input.nombre,
      cedula: input.cedula,
      fecha_nacimiento: toDateOnly(input.fecha_nacimiento),
      numero_licencia: input.numero_licencia,
      fecha_caducidad_licencia: toDateOnly(input.fecha_caducidad_licencia)!,
      telefono: input.telefono,
      email: input.email,
      sueldo_semanal: input.sueldo_semanal ?? 0,
      estado: toPrismaEstadoConductor(input.estado) ?? EstadoConductor.ACTIVO
    }
  });
};

export const updateConductor = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ConductorUpdateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getConductorById(propietarioId, id);

  if (input.cedula) {
    await ensureCedulaAvailable(propietarioId, input.cedula, id);
  }

  if (input.numero_licencia) {
    await ensureLicenciaAvailable(propietarioId, input.numero_licencia, id);
  }

  return prisma.conductor.update({
    where: { id },
    data: {
      nombre: input.nombre,
      cedula: input.cedula,
      fecha_nacimiento:
        Object.hasOwn(input, 'fecha_nacimiento') ? toDateOnly(input.fecha_nacimiento) : undefined,
      numero_licencia: input.numero_licencia,
      fecha_caducidad_licencia: input.fecha_caducidad_licencia
        ? toDateOnly(input.fecha_caducidad_licencia)!
        : undefined,
      telefono: input.telefono,
      email: Object.hasOwn(input, 'email') ? input.email : undefined,
      sueldo_semanal: input.sueldo_semanal,
      estado: toPrismaEstadoConductor(input.estado)
    }
  });
};

export const updateEstadoConductor = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ConductorEstadoInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getConductorById(propietarioId, id);

  return prisma.conductor.update({
    where: { id },
    data: {
      estado: toPrismaEstadoConductor(input.estado)
    }
  });
};

export const deactivateConductor = async (propietarioIdInput: unknown, idInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getConductorById(propietarioId, id);

  return prisma.conductor.update({
    where: { id },
    data: {
      estado: EstadoConductor.INACTIVO
    }
  });
};
