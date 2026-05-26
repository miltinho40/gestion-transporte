import { Prisma, SentidoPeaje } from '@prisma/client';
import type { JwtPayload } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import {
  assertCanWriteScopedRecord,
  resolveReadScope,
  resolveWriteOwnerId
} from '../../utils/ownership-scope.js';
import { toPrismaSentidoPeaje } from './rutas-peajes.mapper.js';
import type { RutaPeajeCreateInput, RutaPeajeUpdateInput } from './rutas-peajes.schema.js';

interface ListFilters {
  ruta_id?: unknown;
  peaje_id?: unknown;
  sentido?: unknown;
}

const includeRelations = {
  ruta: true,
  peaje: true
} satisfies Prisma.RutaPeajeInclude;

const buildWhere = (
  user: JwtPayload | undefined,
  filters: ListFilters
): Prisma.RutaPeajeWhereInput => {
  const scope = resolveReadScope(user);
  const where: Prisma.RutaPeajeWhereInput = {};

  if (!user?.es_super_admin && !scope.all) {
    where.OR = [{ propietario_id: null }, { propietario_id: scope.propietarioId }];
  }

  if (filters.ruta_id) {
    where.ruta_id = parseBigIntId(filters.ruta_id, 'ruta_id');
  }

  if (filters.peaje_id) {
    where.peaje_id = parseBigIntId(filters.peaje_id, 'peaje_id');
  }

  if (filters.sentido === 'ida' || filters.sentido === 'retorno' || filters.sentido === 'ambos') {
    where.sentido = toPrismaSentidoPeaje(filters.sentido);
  }

  return where;
};

const ensureScopedEntityVisible = async (
  entity: 'ruta' | 'peaje',
  user: JwtPayload | undefined,
  id: bigint
) => {
  const scope = resolveReadScope(user);
  const where = {
    id,
    ...(entity === 'ruta' ? { activa: true } : { activo: true }),
    ...(scope.all ? {} : { OR: [{ propietario_id: null }, { propietario_id: scope.propietarioId }] })
  };

  const record =
    entity === 'ruta'
      ? await prisma.ruta.findFirst({ where })
      : await prisma.peaje.findFirst({ where });

  if (!record) {
    throw new AppError(
      entity === 'ruta' ? 'Ruta no encontrada o no disponible' : 'Peaje no encontrado o no disponible',
      404
    );
  }

  return record;
};

const resolveRutaPeajeOwnerId = (
  user: JwtPayload | undefined,
  requestedOwnerId: bigint | null,
  rutaOwnerId: bigint | null,
  peajeOwnerId: bigint | null
) => {
  const entityOwnerIds = [rutaOwnerId, peajeOwnerId].filter((value): value is bigint => value !== null);

  if (requestedOwnerId !== null) {
    const hasOtherOwner = entityOwnerIds.some((ownerId) => ownerId !== requestedOwnerId);
    if (hasOtherOwner) {
      throw new AppError('La ruta y el peaje deben ser globales o pertenecer al propietario actual', 400);
    }

    return requestedOwnerId;
  }

  if (!entityOwnerIds.length) {
    return null;
  }

  const inferredOwnerId = entityOwnerIds[0];
  const hasMixedOwners = entityOwnerIds.some((ownerId) => ownerId !== inferredOwnerId);
  if (hasMixedOwners) {
    throw new AppError('La ruta y el peaje pertenecen a propietarios distintos', 400);
  }

  if (!user?.propietario_id || parseBigIntId(user.propietario_id, 'propietario_id') !== inferredOwnerId) {
    throw new AppError(
      'Una relacion global solo puede usar rutas y peajes globales; desactiva Registro global para usar registros propios',
      400
    );
  }

  return inferredOwnerId;
};

const ensureRutaPeajeAvailable = async (
  propietarioId: bigint | null,
  rutaId: bigint,
  peajeId: bigint,
  sentido: SentidoPeaje,
  excludeId?: bigint
) => {
  const existing = await prisma.rutaPeaje.findFirst({
    where: {
      propietario_id: propietarioId,
      ruta_id: rutaId,
      peaje_id: peajeId,
      sentido
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe esa relacion ruta-peaje con ese sentido en este alcance', 409);
  }
};

export const listRutasPeajes = async (user: JwtPayload | undefined, filters: ListFilters) => {
  return prisma.rutaPeaje.findMany({
    where: buildWhere(user, filters),
    include: includeRelations,
    orderBy: [{ propietario_id: 'asc' }, { ruta_id: 'asc' }, { orden: 'asc' }]
  });
};

export const getRutaPeajeById = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const scope = resolveReadScope(user);

  const item = await prisma.rutaPeaje.findFirst({
    where: {
      id,
      ...(user?.es_super_admin || scope.all
        ? {}
        : { OR: [{ propietario_id: null }, { propietario_id: scope.propietarioId }] })
    },
    include: includeRelations
  });

  if (!item) {
    throw new AppError('Relacion ruta-peaje no encontrada', 404);
  }

  return item;
};

export const createRutaPeaje = async (
  user: JwtPayload | undefined,
  input: RutaPeajeCreateInput
) => {
  const propietarioId = resolveWriteOwnerId(user, input.global);
  const rutaId = parseBigIntId(input.ruta_id, 'ruta_id');
  const peajeId = parseBigIntId(input.peaje_id, 'peaje_id');
  const sentido = toPrismaSentidoPeaje(input.sentido) ?? SentidoPeaje.AMBOS;

  const ruta = await ensureScopedEntityVisible('ruta', user, rutaId);
  const peaje = await ensureScopedEntityVisible('peaje', user, peajeId);
  const relationOwnerId = resolveRutaPeajeOwnerId(
    user,
    propietarioId,
    ruta.propietario_id,
    peaje.propietario_id
  );

  await ensureRutaPeajeAvailable(relationOwnerId, rutaId, peajeId, sentido);

  return prisma.rutaPeaje.create({
    data: {
      propietario_id: relationOwnerId,
      ruta_id: rutaId,
      peaje_id: peajeId,
      orden: input.orden ?? null,
      sentido
    },
    include: includeRelations
  });
};

export const updateRutaPeaje = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: RutaPeajeUpdateInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getRutaPeajeById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  const rutaId = input.ruta_id ? parseBigIntId(input.ruta_id, 'ruta_id') : current.ruta_id;
  const peajeId = input.peaje_id ? parseBigIntId(input.peaje_id, 'peaje_id') : current.peaje_id;
  const sentido = toPrismaSentidoPeaje(input.sentido) ?? current.sentido;

  const ruta = input.ruta_id
    ? await ensureScopedEntityVisible('ruta', user, rutaId)
    : current.ruta;
  const peaje = input.peaje_id
    ? await ensureScopedEntityVisible('peaje', user, peajeId)
    : current.peaje;
  const relationOwnerId = resolveRutaPeajeOwnerId(
    user,
    current.propietario_id,
    ruta.propietario_id,
    peaje.propietario_id
  );

  await ensureRutaPeajeAvailable(relationOwnerId, rutaId, peajeId, sentido, id);

  return prisma.rutaPeaje.update({
    where: { id },
    data: {
      propietario_id: relationOwnerId !== current.propietario_id ? relationOwnerId : undefined,
      ruta_id: input.ruta_id ? rutaId : undefined,
      peaje_id: input.peaje_id ? peajeId : undefined,
      orden: Object.hasOwn(input, 'orden') ? input.orden : undefined,
      sentido: input.sentido ? sentido : undefined
    },
    include: includeRelations
  });
};

export const deleteRutaPeaje = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const current = await getRutaPeajeById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.rutaPeaje.delete({
    where: { id },
    include: includeRelations
  });
};
