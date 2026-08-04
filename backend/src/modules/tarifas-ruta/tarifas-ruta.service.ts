import { Prisma } from '@prisma/client';
import type { JwtPayload } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import type { AuditContext } from '../../utils/audit.js';
import { recordAuditEvent } from '../../utils/audit.js';
import { parseBigIntId } from '../../utils/ids.js';
import { resolveReadScopeWithOwnOverride } from '../../utils/ownership-scope.js';
import { buildPaginatedResult, parsePagination } from '../../utils/pagination.js';
import type {
  TarifaRutaCreateInput,
  TarifaRutaEstadoInput,
  TarifaRutaUpdateInput
} from './tarifas-ruta.schema.js';

interface ListFilters {
  search?: unknown;
  ruta_id?: unknown;
  tipo_carga_id?: unknown;
  activa?: unknown;
  solo_propios?: unknown;
}

const includeRelations = {
  ruta: true,
  tipo_carga: true,
  propietario: {
    select: {
      id: true,
      nombre: true
    }
  }
} satisfies Prisma.TarifaRutaInclude;

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const buildWhere = (
  scopeInput: JwtPayload | unknown,
  filters: ListFilters
): Prisma.TarifaRutaWhereInput => {
  const scope = resolveReadScopeWithOwnOverride(
    scopeInput,
    filters.solo_propios === 'true' || filters.solo_propios === true
  );
  const where: Prisma.TarifaRutaWhereInput = scope.all
    ? {}
    : {
        propietario_id: scope.propietarioId
      };

  if (filters.ruta_id) {
    where.ruta_id = parseBigIntId(filters.ruta_id, 'ruta_id');
  }

  if (filters.tipo_carga_id) {
    where.tipo_carga_id = parseBigIntId(filters.tipo_carga_id, 'tipo_carga_id');
  }

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { ruta: { origen: { contains: search, mode: 'insensitive' } } },
      { ruta: { destino: { contains: search, mode: 'insensitive' } } },
      { tipo_carga: { nombre: { contains: search, mode: 'insensitive' } } },
      { capacidad: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (filters.activa === 'true') where.activa = true;
  if (filters.activa === 'false') where.activa = false;

  return where;
};

const ensureRutaVisible = async (propietarioId: bigint, rutaId: bigint) => {
  const ruta = await prisma.ruta.findFirst({
    where: {
      id: rutaId,
      activa: true,
      OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
    }
  });

  if (!ruta) {
    throw new AppError('Ruta no encontrada o no disponible', 404);
  }
};

const ensureTipoCargaAvailable = async (propietarioId: bigint, tipoCargaId: bigint) => {
  const tipoCarga = await prisma.tipoCarga.findFirst({
    where: {
      id: tipoCargaId,
      activo: true,
      OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
    }
  });

  if (!tipoCarga) {
    throw new AppError('Tipo de carga no encontrado o no disponible', 404);
  }
};

const ensureTarifaRutaAvailable = async (
  propietarioId: bigint,
  rutaId: bigint,
  tipoCargaId: bigint,
  capacidad: string | null,
  toneladas: Prisma.Decimal | number | null,
  vigenteDesde: Date,
  excludeId?: bigint
) => {
  const existing = await prisma.tarifaRuta.findFirst({
    where: {
      propietario_id: propietarioId,
      ruta_id: rutaId,
      tipo_carga_id: tipoCargaId,
      capacidad,
      toneladas,
      vigente_desde: vigenteDesde
    }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError(
      'Ya existe una tarifa para esa ruta, tipo de carga, capacidad, toneladas y fecha de vigencia',
      409
    );
  }
};

export const listTarifasRuta = async (
  scopeInput: JwtPayload | unknown,
  filters: ListFilters
) => {
  const where = buildWhere(scopeInput, filters);
  const orderBy = [
    { activa: 'desc' },
    { ruta_id: 'asc' },
    { tipo_carga_id: 'asc' },
    { vigente_desde: 'desc' }
  ] satisfies Prisma.TarifaRutaOrderByWithRelationInput[];
  const pagination = parsePagination(filters as Record<string, unknown>);

  if (!pagination) {
    return prisma.tarifaRuta.findMany({
      where,
      include: includeRelations,
      orderBy
    });
  }

  const [data, total] = await prisma.$transaction([
    prisma.tarifaRuta.findMany({
      where,
      include: includeRelations,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit
    }),
    prisma.tarifaRuta.count({ where })
  ]);

  return buildPaginatedResult(data, total, pagination);
};

export const getTarifaRutaById = async (
  scopeInput: JwtPayload | unknown,
  idInput: unknown
) => {
  const scope = resolveReadScopeWithOwnOverride(scopeInput, false);
  const id = parseBigIntId(idInput);

  const tarifa = await prisma.tarifaRuta.findFirst({
    where: {
      id,
      ...(scope.all ? {} : { propietario_id: scope.propietarioId })
    },
    include: includeRelations
  });

  if (!tarifa) {
    throw new AppError('Tarifa de ruta no encontrada', 404);
  }

  return tarifa;
};

export const createTarifaRuta = async (
  propietarioIdInput: unknown,
  input: TarifaRutaCreateInput,
  audit?: AuditContext
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const rutaId = parseBigIntId(input.ruta_id, 'ruta_id');
  const tipoCargaId = parseBigIntId(input.tipo_carga_id, 'tipo_carga_id');
  const vigenteDesde = toDateOnly(input.vigente_desde) ?? todayDateOnly();
  const vigenteHasta = toDateOnly(input.vigente_hasta);
  const capacidad = input.capacidad ?? null;
  const toneladas = input.toneladas ?? null;

  if (vigenteHasta && vigenteHasta < vigenteDesde) {
    throw new AppError('vigente_hasta debe ser mayor o igual a vigente_desde', 400);
  }

  await ensureRutaVisible(propietarioId, rutaId);
  await ensureTipoCargaAvailable(propietarioId, tipoCargaId);
  await ensureTarifaRutaAvailable(
    propietarioId,
    rutaId,
    tipoCargaId,
    capacidad,
    toneladas,
    vigenteDesde
  );

  const tarifa = await prisma.tarifaRuta.create({
    data: {
      propietario_id: propietarioId,
      ruta_id: rutaId,
      tipo_carga_id: tipoCargaId,
      capacidad,
      toneladas,
      precio: input.precio,
      vigente_desde: vigenteDesde,
      vigente_hasta: vigenteHasta,
      activa: input.activa ?? true
    },
    include: includeRelations
  });

  await recordAuditEvent({
    ...audit,
    propietarioId: propietarioIdInput,
    entidad: 'tarifa_ruta',
    entidadId: tarifa.id,
    accion: 'crear',
    resumen: `Tarifa creada ${tarifa.ruta.origen} - ${tarifa.ruta.destino}`,
    despues: tarifa
  });

  return tarifa;
};

export const updateTarifaRuta = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: TarifaRutaUpdateInput,
  audit?: AuditContext
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getTarifaRutaById(propietarioId, id);

  const rutaId = input.ruta_id ? parseBigIntId(input.ruta_id, 'ruta_id') : current.ruta_id;
  const tipoCargaId = input.tipo_carga_id
    ? parseBigIntId(input.tipo_carga_id, 'tipo_carga_id')
    : current.tipo_carga_id;
  const vigenteDesde = input.vigente_desde
    ? toDateOnly(input.vigente_desde)!
    : current.vigente_desde;
  const vigenteHasta = Object.hasOwn(input, 'vigente_hasta')
    ? toDateOnly(input.vigente_hasta)
    : current.vigente_hasta;
  const capacidad = Object.hasOwn(input, 'capacidad')
    ? input.capacidad ?? null
    : current.capacidad;
  const toneladas = Object.hasOwn(input, 'toneladas')
    ? input.toneladas ?? null
    : current.toneladas;

  if (vigenteHasta && vigenteHasta < vigenteDesde) {
    throw new AppError('vigente_hasta debe ser mayor o igual a vigente_desde', 400);
  }

  if (input.ruta_id) await ensureRutaVisible(propietarioId, rutaId);
  if (input.tipo_carga_id) await ensureTipoCargaAvailable(propietarioId, tipoCargaId);

  await ensureTarifaRutaAvailable(
    propietarioId,
    rutaId,
    tipoCargaId,
    capacidad,
    toneladas,
    vigenteDesde,
    id
  );

  const tarifa = await prisma.tarifaRuta.update({
    where: { id },
    data: {
      ruta_id: input.ruta_id ? rutaId : undefined,
      tipo_carga_id: input.tipo_carga_id ? tipoCargaId : undefined,
      capacidad: Object.hasOwn(input, 'capacidad') ? capacidad : undefined,
      toneladas: Object.hasOwn(input, 'toneladas') ? toneladas : undefined,
      precio: input.precio,
      vigente_desde: input.vigente_desde ? vigenteDesde : undefined,
      vigente_hasta: Object.hasOwn(input, 'vigente_hasta') ? vigenteHasta : undefined,
      activa: input.activa
    },
    include: includeRelations
  });

  await recordAuditEvent({
    ...audit,
    propietarioId: propietarioIdInput,
    entidad: 'tarifa_ruta',
    entidadId: tarifa.id,
    accion: 'actualizar',
    resumen: `Tarifa actualizada ${tarifa.ruta.origen} - ${tarifa.ruta.destino}`,
    antes: current,
    despues: tarifa
  });

  return tarifa;
};

export const updateEstadoTarifaRuta = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: TarifaRutaEstadoInput,
  audit?: AuditContext
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const current = await getTarifaRutaById(propietarioId, id);

  const tarifa = await prisma.tarifaRuta.update({
    where: { id },
    data: { activa: input.activa },
    include: includeRelations
  });

  await recordAuditEvent({
    ...audit,
    propietarioId: propietarioIdInput,
    entidad: 'tarifa_ruta',
    entidadId: tarifa.id,
    accion: input.activa ? 'activar' : 'desactivar',
    resumen: input.activa ? 'Tarifa activada' : 'Tarifa desactivada',
    antes: { activa: current.activa },
    despues: { activa: tarifa.activa }
  });

  return tarifa;
};

export const deactivateTarifaRuta = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  audit?: AuditContext
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const current = await getTarifaRutaById(propietarioId, id);

  if (current.activa) {
    const tarifa = await prisma.tarifaRuta.update({
      where: { id },
      data: { activa: false },
      include: includeRelations
    });

    await recordAuditEvent({
      ...audit,
      propietarioId: propietarioIdInput,
      entidad: 'tarifa_ruta',
      entidadId: tarifa.id,
      accion: 'desactivar',
      resumen: `Tarifa desactivada ${tarifa.ruta.origen} - ${tarifa.ruta.destino}`,
      antes: { activa: current.activa },
      despues: { activa: tarifa.activa }
    });

    return tarifa;
  }

  const [viajes, viajesProveedor] = await Promise.all([
    prisma.viaje.count({
      where: {
        propietario_id: propietarioId,
        tarifa_ruta_id: id
      }
    }),
    prisma.viajeProveedor.count({
      where: {
        propietario_id: propietarioId,
        tarifa_ruta_id: id
      }
    })
  ]);

  if (viajes > 0 || viajesProveedor > 0) {
    throw new AppError('La tarifa ruta ya esta usada en algunos viajes', 409);
  }

  await prisma.tarifaRuta.delete({
    where: { id }
  });

  await recordAuditEvent({
    ...audit,
    propietarioId: propietarioIdInput,
    entidad: 'tarifa_ruta',
    entidadId: current.id,
    accion: 'eliminar',
    resumen: `Tarifa eliminada ${current.ruta.origen} - ${current.ruta.destino}`,
    antes: current,
    despues: null
  });

  return current;
};
