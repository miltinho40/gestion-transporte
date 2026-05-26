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
import type { RutaCreateInput, RutaEstadoInput, RutaUpdateInput } from './rutas.schema.js';

interface ListFilters {
  search?: unknown;
  activa?: unknown;
}

const buildWhere = (user: JwtPayload | undefined, filters: ListFilters): Prisma.RutaWhereInput => {
  const scope = resolveReadScope(user);
  const where: Prisma.RutaWhereInput = {};

  if (!scope.all) {
    where.OR = [{ propietario_id: null }, { propietario_id: scope.propietarioId }];
  }

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.AND = [
      {
        OR: [
          { origen: { contains: search, mode: 'insensitive' } },
          { destino: { contains: search, mode: 'insensitive' } }
        ]
      }
    ];
  }

  if (filters.activa === 'true') where.activa = true;
  if (filters.activa === 'false') where.activa = false;

  return where;
};

const buildIncludeRelations = (user: JwtPayload | undefined): Prisma.RutaInclude => {
  const scope = resolveReadScope(user);
  const rutaPeajeWhere: Prisma.RutaPeajeWhereInput = scope.all
    ? {}
    : {
        OR: [{ propietario_id: null }, { propietario_id: scope.propietarioId }],
        peaje: {
          OR: [{ propietario_id: null }, { propietario_id: scope.propietarioId }]
        }
      };

  return {
    rutas_peajes: {
      where: rutaPeajeWhere,
      include: {
        peaje: true
      },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }]
    }
  };
};

const ensureRutaAvailable = async (
  propietarioId: bigint | null,
  origen: string,
  destino: string,
  excludeId?: bigint
) => {
  const existing = await prisma.ruta.findFirst({
    where: {
      propietario_id: propietarioId,
      origen,
      destino
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe una ruta con ese origen y destino en este alcance', 409);
  }
};

const toPrismaSentidoPeaje = (value?: 'ida' | 'retorno' | 'ambos') => {
  if (value === 'ida') return SentidoPeaje.IDA;
  if (value === 'retorno') return SentidoPeaje.RETORNO;
  return SentidoPeaje.AMBOS;
};

const ensurePeajeVisibleForRuta = async (
  user: JwtPayload | undefined,
  rutaOwnerId: bigint | null,
  peajeId: bigint
) => {
  const peaje = await prisma.peaje.findFirst({
    where: {
      id: peajeId,
      activo: true,
      ...(user?.es_super_admin && rutaOwnerId === null
        ? {}
        : rutaOwnerId === null
        ? { propietario_id: null }
        : { OR: [{ propietario_id: null }, { propietario_id: rutaOwnerId }] })
    }
  });

  if (!peaje) {
    throw new AppError('Peaje no encontrado o no disponible para la ruta', 404);
  }
};

const syncRutaPeajes = async (
  tx: Prisma.TransactionClient,
  user: JwtPayload | undefined,
  rutaId: bigint,
  rutaOwnerId: bigint | null,
  peajes: NonNullable<RutaCreateInput['peajes']>
) => {
  const seen = new Set<string>();
  const data = [];

  for (const [index, item] of peajes.entries()) {
    const peajeId = parseBigIntId(item.peaje_id, 'peaje_id');
    const sentido = toPrismaSentidoPeaje(item.sentido);
    const key = `${peajeId.toString()}-${sentido}`;

    if (seen.has(key)) {
      throw new AppError('No puedes repetir el mismo peaje con el mismo sentido en una ruta', 400);
    }

    seen.add(key);
    await ensurePeajeVisibleForRuta(user, rutaOwnerId, peajeId);
    data.push({
      propietario_id: rutaOwnerId,
      ruta_id: rutaId,
      peaje_id: peajeId,
      orden: item.orden ?? index + 1,
      sentido
    });
  }

  await tx.rutaPeaje.deleteMany({
    where: {
      ruta_id: rutaId,
      propietario_id: rutaOwnerId
    }
  });

  if (data.length) {
    await tx.rutaPeaje.createMany({ data });
  }
};

export const listRutas = async (user: JwtPayload | undefined, filters: ListFilters) => {
  return prisma.ruta.findMany({
    where: buildWhere(user, filters),
    include: buildIncludeRelations(user),
    orderBy: [{ activa: 'desc' }, { propietario_id: 'asc' }, { origen: 'asc' }, { destino: 'asc' }]
  });
};

export const getRutaById = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const scope = resolveReadScope(user);

  const ruta = await prisma.ruta.findFirst({
    where: {
      id,
      ...(scope.all ? {} : { OR: [{ propietario_id: null }, { propietario_id: scope.propietarioId }] })
    },
    include: buildIncludeRelations(user)
  });

  if (!ruta) {
    throw new AppError('Ruta no encontrada', 404);
  }

  return ruta;
};

export const createRuta = async (user: JwtPayload | undefined, input: RutaCreateInput) => {
  const propietarioId = resolveWriteOwnerId(user, input.global);
  await ensureRutaAvailable(propietarioId, input.origen, input.destino);

  const ruta = await prisma.$transaction(async (tx) => {
    const created = await tx.ruta.create({
      data: {
        propietario_id: propietarioId,
        origen: input.origen,
        destino: input.destino,
        distancia_km: input.distancia_km ?? 0,
        duracion_estimada_horas: input.duracion_estimada_horas ?? null,
        activa: input.activa ?? true
      }
    });

    if (input.peajes) {
      await syncRutaPeajes(tx, user, created.id, propietarioId, input.peajes);
    }

    return created;
  });

  return getRutaById(user, ruta.id);
};

export const updateRuta = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: RutaUpdateInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getRutaById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  const origen = input.origen ?? current.origen;
  const destino = input.destino ?? current.destino;
  const { peajes, ...rutaInput } = input;

  if (input.origen || input.destino) {
    await ensureRutaAvailable(current.propietario_id, origen, destino, id);
  }

  await prisma.$transaction(async (tx) => {
    await tx.ruta.update({
      where: { id },
      data: rutaInput
    });

    if (peajes) {
      await syncRutaPeajes(tx, user, id, current.propietario_id, peajes);
    }
  });

  return getRutaById(user, id);
};

export const updateEstadoRuta = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: RutaEstadoInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getRutaById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.ruta.update({
    where: { id },
    data: { activa: input.activa }
  });
};

export const deactivateRuta = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const current = await getRutaById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.ruta.update({
    where: { id },
    data: { activa: false }
  });
};
