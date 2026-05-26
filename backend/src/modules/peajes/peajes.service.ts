import { Prisma } from '@prisma/client';
import type { JwtPayload } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import {
  assertCanWriteScopedRecord,
  resolveReadScope,
  resolveWriteOwnerId
} from '../../utils/ownership-scope.js';
import type { PeajeCreateInput, PeajeEstadoInput, PeajeUpdateInput } from './peajes.schema.js';

interface ListFilters {
  search?: unknown;
  activo?: unknown;
}

const buildWhere = (user: JwtPayload | undefined, filters: ListFilters): Prisma.PeajeWhereInput => {
  const scope = resolveReadScope(user);
  const where: Prisma.PeajeWhereInput = {};

  if (!user?.es_super_admin && !scope.all) {
    where.OR = [{ propietario_id: null }, { propietario_id: scope.propietarioId }];
  }

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.AND = [
      {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { ubicacion: { contains: search, mode: 'insensitive' } }
        ]
      }
    ];
  }

  if (filters.activo === 'true') where.activo = true;
  if (filters.activo === 'false') where.activo = false;

  return where;
};

const includeRelations = {
  tarifas_peaje: {
    include: {
      categoria_peaje: true
    },
    orderBy: [{ activa: 'desc' }, { vigente_desde: 'desc' }, { id: 'asc' }]
  }
} satisfies Prisma.PeajeInclude;

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const ensureNombreAvailable = async (
  propietarioId: bigint | null,
  nombre: string,
  excludeId?: bigint
) => {
  const existing = await prisma.peaje.findFirst({
    where: {
      propietario_id: propietarioId,
      nombre
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe un peaje con ese nombre en este alcance', 409);
  }
};

const ensureCategoriaVisibleForPeaje = async (categoriaPeajeId: bigint) => {
  const categoria = await prisma.categoriaPeaje.findFirst({
    where: {
      id: categoriaPeajeId,
      activo: true
    }
  });

  if (!categoria) {
    throw new AppError('Categoria de peaje no encontrada o no disponible para el peaje', 404);
  }
};

const syncTarifasPeaje = async (
  tx: Prisma.TransactionClient,
  peajeId: bigint,
  peajeOwnerId: bigint | null,
  tarifas: NonNullable<PeajeCreateInput['tarifas']>
) => {
  const seen = new Set<string>();
  const data = [];

  for (const item of tarifas) {
    const categoriaPeajeId = parseBigIntId(item.categoria_peaje_id, 'categoria_peaje_id');
    const vigenteDesde = toDateOnly(item.vigente_desde) ?? todayDateOnly();
    const vigenteHasta = toDateOnly(item.vigente_hasta);

    if (vigenteHasta && vigenteHasta < vigenteDesde) {
      throw new AppError('vigente_hasta debe ser mayor o igual a vigente_desde', 400);
    }

    const key = `${categoriaPeajeId.toString()}-${vigenteDesde.toISOString().slice(0, 10)}`;
    if (seen.has(key)) {
      throw new AppError('No puedes repetir categoria y fecha de vigencia en el mismo peaje', 400);
    }

    seen.add(key);
    await ensureCategoriaVisibleForPeaje(categoriaPeajeId);
    data.push({
      propietario_id: peajeOwnerId,
      peaje_id: peajeId,
      categoria_peaje_id: categoriaPeajeId,
      valor: item.valor,
      vigente_desde: vigenteDesde,
      vigente_hasta: vigenteHasta,
      activa: item.activa ?? true
    });
  }

  await tx.tarifaPeaje.deleteMany({
    where: {
      peaje_id: peajeId,
      propietario_id: peajeOwnerId
    }
  });

  if (data.length) {
    await tx.tarifaPeaje.createMany({ data });
  }
};

export const listPeajes = async (user: JwtPayload | undefined, filters: ListFilters) => {
  return prisma.peaje.findMany({
    where: buildWhere(user, filters),
    include: includeRelations,
    orderBy: [{ activo: 'desc' }, { propietario_id: 'asc' }, { nombre: 'asc' }]
  });
};

export const getPeajeById = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const scope = resolveReadScope(user);

  const peaje = await prisma.peaje.findFirst({
    where: {
      id,
      ...(user?.es_super_admin || scope.all
        ? {}
        : { OR: [{ propietario_id: null }, { propietario_id: scope.propietarioId }] })
    },
    include: includeRelations
  });

  if (!peaje) {
    throw new AppError('Peaje no encontrado', 404);
  }

  return peaje;
};

export const createPeaje = async (user: JwtPayload | undefined, input: PeajeCreateInput) => {
  const propietarioId = resolveWriteOwnerId(user, input.global);
  const { tarifas, ...peajeInput } = input;
  await ensureNombreAvailable(propietarioId, input.nombre);

  const peaje = await prisma.$transaction(async (tx) => {
    const created = await tx.peaje.create({
      data: {
        propietario_id: propietarioId,
        nombre: peajeInput.nombre,
        ubicacion: peajeInput.ubicacion,
        activo: peajeInput.activo ?? true
      }
    });

    if (tarifas) {
      await syncTarifasPeaje(tx, created.id, propietarioId, tarifas);
    }

    return created;
  });

  return getPeajeById(user, peaje.id);
};

export const updatePeaje = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: PeajeUpdateInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getPeajeById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);
  const { tarifas, ...peajeInput } = input;

  if (peajeInput.nombre) {
    await ensureNombreAvailable(current.propietario_id, peajeInput.nombre, id);
  }

  await prisma.$transaction(async (tx) => {
    await tx.peaje.update({
      where: { id },
      data: peajeInput
    });

    if (tarifas) {
      await syncTarifasPeaje(tx, id, current.propietario_id, tarifas);
    }
  });

  return getPeajeById(user, id);
};

export const updateEstadoPeaje = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: PeajeEstadoInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getPeajeById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.peaje.update({
    where: { id },
    data: { activo: input.activo }
  });
};

export const deactivatePeaje = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const current = await getPeajeById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.peaje.update({
    where: { id },
    data: { activo: false }
  });
};
