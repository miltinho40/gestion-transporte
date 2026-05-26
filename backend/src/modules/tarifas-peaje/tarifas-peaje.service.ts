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
import type {
  TarifaPeajeCreateInput,
  TarifaPeajeEstadoInput,
  TarifaPeajeUpdateInput
} from './tarifas-peaje.schema.js';

interface ListFilters {
  peaje_id?: unknown;
  categoria_peaje_id?: unknown;
  activa?: unknown;
}

const includeRelations = {
  peaje: true,
  categoria_peaje: true
} satisfies Prisma.TarifaPeajeInclude;

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const buildWhere = (
  user: JwtPayload | undefined,
  filters: ListFilters
): Prisma.TarifaPeajeWhereInput => {
  const scope = resolveReadScope(user);
  const where: Prisma.TarifaPeajeWhereInput = {};

  if (!user?.es_super_admin && !scope.all) {
    where.OR = [{ propietario_id: null }, { propietario_id: scope.propietarioId }];
  }

  if (filters.peaje_id) {
    where.peaje_id = parseBigIntId(filters.peaje_id, 'peaje_id');
  }

  if (filters.categoria_peaje_id) {
    where.categoria_peaje_id = parseBigIntId(
      filters.categoria_peaje_id,
      'categoria_peaje_id'
    );
  }

  if (filters.activa === 'true') where.activa = true;
  if (filters.activa === 'false') where.activa = false;

  return where;
};

const ensureScopedEntityVisible = async (
  entity: 'peaje' | 'categoriaPeaje',
  propietarioId: bigint | null,
  id: bigint
) => {
  const where = {
    id,
    activo: true,
    ...(entity === 'categoriaPeaje'
      ? {}
      : propietarioId === null
      ? { propietario_id: null }
      : { OR: [{ propietario_id: null }, { propietario_id: propietarioId }] })
  };

  const record =
    entity === 'peaje'
      ? await prisma.peaje.findFirst({ where })
      : await prisma.categoriaPeaje.findFirst({ where });

  if (!record) {
    throw new AppError(
      entity === 'peaje'
        ? 'Peaje no encontrado o no disponible'
        : 'Categoria de peaje no encontrada o no disponible',
      404
    );
  }
};

const ensureTarifaAvailable = async (
  propietarioId: bigint | null,
  peajeId: bigint,
  categoriaPeajeId: bigint,
  vigenteDesde: Date,
  excludeId?: bigint
) => {
  const existing = await prisma.tarifaPeaje.findFirst({
    where: {
      propietario_id: propietarioId,
      peaje_id: peajeId,
      categoria_peaje_id: categoriaPeajeId,
      vigente_desde: vigenteDesde
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError(
      'Ya existe una tarifa para ese peaje, categoria y fecha de vigencia en este alcance',
      409
    );
  }
};

export const listTarifasPeaje = async (
  user: JwtPayload | undefined,
  filters: ListFilters
) => {
  return prisma.tarifaPeaje.findMany({
    where: buildWhere(user, filters),
    include: includeRelations,
    orderBy: [{ activa: 'desc' }, { propietario_id: 'asc' }, { vigente_desde: 'desc' }]
  });
};

export const getTarifaPeajeById = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const scope = resolveReadScope(user);

  const tarifa = await prisma.tarifaPeaje.findFirst({
    where: {
      id,
      ...(user?.es_super_admin || scope.all
        ? {}
        : { OR: [{ propietario_id: null }, { propietario_id: scope.propietarioId }] })
    },
    include: includeRelations
  });

  if (!tarifa) {
    throw new AppError('Tarifa de peaje no encontrada', 404);
  }

  return tarifa;
};

export const createTarifaPeaje = async (
  user: JwtPayload | undefined,
  input: TarifaPeajeCreateInput
) => {
  const propietarioId = resolveWriteOwnerId(user, input.global);
  const peajeId = parseBigIntId(input.peaje_id, 'peaje_id');
  const categoriaPeajeId = parseBigIntId(input.categoria_peaje_id, 'categoria_peaje_id');
  const vigenteDesde = toDateOnly(input.vigente_desde) ?? todayDateOnly();

  await ensureScopedEntityVisible('peaje', propietarioId, peajeId);
  await ensureScopedEntityVisible('categoriaPeaje', propietarioId, categoriaPeajeId);
  await ensureTarifaAvailable(propietarioId, peajeId, categoriaPeajeId, vigenteDesde);

  return prisma.tarifaPeaje.create({
    data: {
      propietario_id: propietarioId,
      peaje_id: peajeId,
      categoria_peaje_id: categoriaPeajeId,
      valor: input.valor,
      vigente_desde: vigenteDesde,
      vigente_hasta: toDateOnly(input.vigente_hasta),
      activa: input.activa ?? true
    },
    include: includeRelations
  });
};

export const updateTarifaPeaje = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: TarifaPeajeUpdateInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getTarifaPeajeById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  const peajeId = input.peaje_id ? parseBigIntId(input.peaje_id, 'peaje_id') : current.peaje_id;
  const categoriaPeajeId = input.categoria_peaje_id
    ? parseBigIntId(input.categoria_peaje_id, 'categoria_peaje_id')
    : current.categoria_peaje_id;
  const vigenteDesde = input.vigente_desde
    ? toDateOnly(input.vigente_desde)!
    : current.vigente_desde;
  const vigenteHasta = Object.hasOwn(input, 'vigente_hasta')
    ? toDateOnly(input.vigente_hasta)
    : current.vigente_hasta;

  if (vigenteHasta && vigenteHasta < vigenteDesde) {
    throw new AppError('vigente_hasta debe ser mayor o igual a vigente_desde', 400);
  }

  if (input.peaje_id) await ensureScopedEntityVisible('peaje', current.propietario_id, peajeId);
  if (input.categoria_peaje_id) {
    await ensureScopedEntityVisible('categoriaPeaje', current.propietario_id, categoriaPeajeId);
  }

  await ensureTarifaAvailable(
    current.propietario_id,
    peajeId,
    categoriaPeajeId,
    vigenteDesde,
    id
  );

  return prisma.tarifaPeaje.update({
    where: { id },
    data: {
      peaje_id: input.peaje_id ? peajeId : undefined,
      categoria_peaje_id: input.categoria_peaje_id ? categoriaPeajeId : undefined,
      valor: input.valor,
      vigente_desde: input.vigente_desde ? vigenteDesde : undefined,
      vigente_hasta: Object.hasOwn(input, 'vigente_hasta') ? vigenteHasta : undefined,
      activa: input.activa
    },
    include: includeRelations
  });
};

export const updateEstadoTarifaPeaje = async (
  user: JwtPayload | undefined,
  idInput: unknown,
  input: TarifaPeajeEstadoInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getTarifaPeajeById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.tarifaPeaje.update({
    where: { id },
    data: { activa: input.activa },
    include: includeRelations
  });
};

export const deactivateTarifaPeaje = async (user: JwtPayload | undefined, idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const current = await getTarifaPeajeById(user, id);
  assertCanWriteScopedRecord(user, current.propietario_id);

  return prisma.tarifaPeaje.update({
    where: { id },
    data: { activa: false },
    include: includeRelations
  });
};
