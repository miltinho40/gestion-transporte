import { EstadoViaje, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import type { AuditContext } from '../../utils/audit.js';
import { recordAuditEvent } from '../../utils/audit.js';
import { parseBigIntId } from '../../utils/ids.js';
import { buildPaginatedResult, parsePagination } from '../../utils/pagination.js';
import { toPrismaEstadoViajeProveedor } from './viajes-proveedor.mapper.js';
import type {
  ViajeProveedorCobroInput,
  ViajeProveedorCreateInput,
  ViajeProveedorEstadoInput,
  ViajeProveedorGuiasInput,
  ViajeProveedorPagoInput,
  ViajeProveedorUpdateInput
} from './viajes-proveedor.schema.js';

interface ListViajesProveedorFilters {
  search?: unknown;
  cliente_search?: unknown;
  proveedor_search?: unknown;
  cliente_ids?: unknown;
  proveedor_ids?: unknown;
  cliente_id?: unknown;
  proveedor_id?: unknown;
  tarifa_ruta_id?: unknown;
  ruta_id?: unknown;
  estado?: unknown;
  cobrado?: unknown;
  pagado_proveedor?: unknown;
  anio_semana?: unknown;
  numero_semana?: unknown;
  fecha_desde?: unknown;
  fecha_hasta?: unknown;
}

interface ResumenViajesProveedorFilters {
  anio?: unknown;
  meses?: unknown;
  proveedor_ids?: unknown;
}

const includeRelations = {
  cliente: true,
  proveedor: true,
  tarifa_ruta: {
    include: {
      ruta: true,
      tipo_carga: true
    }
  }
} satisfies Prisma.ViajeProveedorInclude;

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const parseDateFilter = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !dateOnlyPattern.test(value)) {
    throw new AppError(`${field} debe tener formato YYYY-MM-DD`, 400);
  }

  return toDateOnly(value)!;
};

const parsePositiveIntegerFilter = (value: unknown, field: string) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${field} debe ser un entero positivo`, 400);
  }

  return parsed;
};

const getIsoWeekRange = (anio: number, numeroSemana: number) => {
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const fechaInicio = new Date(week1Monday);
  fechaInicio.setUTCDate(week1Monday.getUTCDate() + (numeroSemana - 1) * 7);

  const fechaFin = new Date(fechaInicio);
  fechaFin.setUTCDate(fechaInicio.getUTCDate() + 6);

  return { fechaInicio, fechaFin };
};

const buildViajeSemanaWhere = (
  fechaInicio: Date,
  fechaFin: Date
): Prisma.ViajeProveedorWhereInput => ({
  OR: [
    {
      fecha_llegada: {
        gte: fechaInicio,
        lte: fechaFin
      }
    },
    {
      fecha_llegada: null,
      fecha_salida: {
        gte: fechaInicio,
        lte: fechaFin
      }
    }
  ]
});

const appendAnd = (
  where: Prisma.ViajeProveedorWhereInput,
  condition: Prisma.ViajeProveedorWhereInput
) => {
  where.AND = Array.isArray(where.AND) ? [...where.AND, condition] : [condition];
};

const toMoney = (value: number | string | Prisma.Decimal) => {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
};

const calculateUtilidad = (
  valorAFacturar: number | string | Prisma.Decimal,
  precioPagarProveedor: number | string | Prisma.Decimal,
  viaticos: number | string | Prisma.Decimal
) =>
  toMoney(valorAFacturar)
    .minus(toMoney(precioPagarProveedor))
    .minus(toMoney(viaticos))
    .toDecimalPlaces(2);

const calculateValorAFacturar = (
  precioViaje: number | string | Prisma.Decimal,
  porcentajeComision: number | string | Prisma.Decimal
) => {
  const precio = toMoney(precioViaje);
  const comision = precio.mul(new Prisma.Decimal(porcentajeComision)).div(100);
  return precio.minus(comision).toDecimalPlaces(2);
};

const calculatePrecioPagarProveedor = (
  valorAFacturar: number | string | Prisma.Decimal,
  porcentajeUtilidad: number | string | Prisma.Decimal
) => {
  const valor = toMoney(valorAFacturar);
  const utilidad = valor.mul(new Prisma.Decimal(porcentajeUtilidad)).div(100);
  return valor.minus(utilidad).toDecimalPlaces(2);
};

const resolveFechaOperacion = (
  activo: boolean,
  fechaInput?: string | null,
  currentFecha?: Date | null
) => {
  if (!activo) return null;
  return toDateOnly(fechaInput) ?? currentFecha ?? todayDateOnly();
};

const resolveSoporteOperacion = (
  activo: boolean,
  soporteInput?: string | null,
  sinFacturaInput?: boolean,
  current?: { soporte?: string | null; sinFactura?: boolean }
) => {
  if (!activo) {
    return {
      soporte: null,
      sinFactura: false
    };
  }

  const sinFactura = sinFacturaInput ?? current?.sinFactura ?? false;

  return {
    soporte: sinFactura ? null : soporteInput ?? current?.soporte ?? null,
    sinFactura
  };
};

const assertFechaLlegadaValida = (fechaSalida: Date, fechaLlegada: Date | null) => {
  if (fechaLlegada && fechaLlegada < fechaSalida) {
    throw new AppError('fecha_llegada debe ser mayor o igual a fecha_salida', 400);
  }
};

const assertTarifaVigente = (
  tarifa: { vigente_desde: Date; vigente_hasta: Date | null },
  fechaSalida: Date
) => {
  if (fechaSalida < tarifa.vigente_desde) {
    throw new AppError('La fecha de salida es anterior a la vigencia de la tarifa', 400);
  }

  if (tarifa.vigente_hasta && fechaSalida > tarifa.vigente_hasta) {
    throw new AppError('La fecha de salida es posterior a la vigencia de la tarifa', 400);
  }
};

const findGuideSearchIds = async (propietarioId: bigint, search: unknown) => {
  if (typeof search !== 'string' || !search.trim()) return [];

  const term = `%${search.trim()}%`;
  const rows = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM viajes_proveedor
    WHERE propietario_id = ${propietarioId}
      AND EXISTS (
        SELECT 1
        FROM unnest(numeros_guia_remision) AS guia
        WHERE guia ILIKE ${term}
      )
  `;

  return rows.map((row) => row.id);
};

const buildWhere = (
  propietarioId: bigint,
  filters: ListViajesProveedorFilters,
  guideSearchIds: bigint[] = []
): Prisma.ViajeProveedorWhereInput => {
  const where: Prisma.ViajeProveedorWhereInput = {
    propietario_id: propietarioId
  };

  if (filters.cliente_id) where.cliente_id = parseBigIntId(filters.cliente_id, 'cliente_id');
  const clienteIds = parseIdList(filters.cliente_ids, 'cliente_ids');
  if (clienteIds.length) where.cliente_id = { in: clienteIds };

  if (filters.proveedor_id) {
    where.proveedor_id = parseBigIntId(filters.proveedor_id, 'proveedor_id');
  }
  const proveedorIds = parseIdList(filters.proveedor_ids, 'proveedor_ids');
  if (proveedorIds.length) where.proveedor_id = { in: proveedorIds };

  if (filters.tarifa_ruta_id) {
    where.tarifa_ruta_id = parseBigIntId(filters.tarifa_ruta_id, 'tarifa_ruta_id');
  }
  if (filters.ruta_id) {
    where.tarifa_ruta = {
      ruta_id: parseBigIntId(filters.ruta_id, 'ruta_id')
    };
  }

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    appendAnd(where, {
      OR: [
        { descripcion_carga: { contains: search, mode: 'insensitive' } },
        { observaciones: { contains: search, mode: 'insensitive' } },
        { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
        { cliente: { ruc_cedula: { contains: search, mode: 'insensitive' } } },
        { proveedor: { nombre: { contains: search, mode: 'insensitive' } } },
        { proveedor: { ruc_cedula: { contains: search, mode: 'insensitive' } } },
        { tarifa_ruta: { ruta: { origen: { contains: search, mode: 'insensitive' } } } },
        { tarifa_ruta: { ruta: { destino: { contains: search, mode: 'insensitive' } } } },
        { numeros_guia_remision: { has: search } },
        ...(guideSearchIds.length ? [{ id: { in: guideSearchIds } }] : [])
      ]
    });
  }

  if (typeof filters.cliente_search === 'string' && filters.cliente_search.trim()) {
    const search = filters.cliente_search.trim();
    appendAnd(where, {
      OR: [
        { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
        { cliente: { ruc_cedula: { contains: search, mode: 'insensitive' } } }
      ]
    });
  }

  if (typeof filters.proveedor_search === 'string' && filters.proveedor_search.trim()) {
    const search = filters.proveedor_search.trim();
    appendAnd(where, {
      OR: [
        { proveedor: { nombre: { contains: search, mode: 'insensitive' } } },
        { proveedor: { ruc_cedula: { contains: search, mode: 'insensitive' } } }
      ]
    });
  }

  if (
    filters.estado === 'programado' ||
    filters.estado === 'en_curso' ||
    filters.estado === 'completado' ||
    filters.estado === 'cancelado'
  ) {
    where.estado = toPrismaEstadoViajeProveedor(filters.estado);
  }

  if (filters.cobrado === 'true') where.cobrado = true;
  if (filters.cobrado === 'false') where.cobrado = false;
  if (filters.pagado_proveedor === 'true') where.pagado_proveedor = true;
  if (filters.pagado_proveedor === 'false') where.pagado_proveedor = false;

  if (filters.numero_semana) {
    const numeroSemana = parsePositiveIntegerFilter(filters.numero_semana, 'numero_semana');
    if (numeroSemana > 53) {
      throw new AppError('numero_semana debe estar entre 1 y 53', 400);
    }

    const anioSemana = filters.anio_semana
      ? parsePositiveIntegerFilter(filters.anio_semana, 'anio_semana')
      : new Date().getUTCFullYear();
    const { fechaInicio, fechaFin } = getIsoWeekRange(anioSemana, numeroSemana);
    appendAnd(where, buildViajeSemanaWhere(fechaInicio, fechaFin));
  }

  if (filters.fecha_desde || filters.fecha_hasta) {
    appendAnd(where, {
      OR: [
        {
          fecha_llegada: {
            gte: filters.fecha_desde
              ? parseDateFilter(filters.fecha_desde, 'fecha_desde')
              : undefined,
            lte: filters.fecha_hasta
              ? parseDateFilter(filters.fecha_hasta, 'fecha_hasta')
              : undefined
          }
        },
        {
          fecha_llegada: null,
          fecha_salida: {
            gte: filters.fecha_desde
              ? parseDateFilter(filters.fecha_desde, 'fecha_desde')
              : undefined,
            lte: filters.fecha_hasta
              ? parseDateFilter(filters.fecha_hasta, 'fecha_hasta')
              : undefined
          }
        }
      ]
    });
  }

  return where;
};

const getClienteForWrite = async (propietarioId: bigint, clienteId: bigint) => {
  const cliente = await prisma.cliente.findFirst({
    where: {
      id: clienteId,
      propietario_id: propietarioId,
      activo: true
    }
  });

  if (!cliente) {
    throw new AppError('Cliente no encontrado o no disponible', 404);
  }

  return cliente;
};

const getProveedorForWrite = async (propietarioId: bigint, proveedorId: bigint) => {
  const proveedor = await prisma.proveedor.findFirst({
    where: {
      id: proveedorId,
      propietario_id: propietarioId,
      activo: true
    }
  });

  if (!proveedor) {
    throw new AppError('Proveedor no encontrado o no disponible', 404);
  }

  return proveedor;
};

const getTarifaRutaForWrite = async (
  propietarioId: bigint,
  tarifaRutaId: bigint,
  fechaSalida: Date
) => {
  const tarifa = await prisma.tarifaRuta.findFirst({
    where: {
      id: tarifaRutaId,
      propietario_id: propietarioId,
      activa: true
    },
    include: {
      ruta: true,
      tipo_carga: true
    }
  });

  if (!tarifa) {
    throw new AppError('Tarifa de ruta no encontrada o no disponible', 404);
  }

  if (!tarifa.ruta.activa || !tarifa.tipo_carga.activo) {
    throw new AppError('La ruta o el tipo de carga de la tarifa no estan disponibles', 404);
  }

  assertTarifaVigente(tarifa, fechaSalida);

  return tarifa;
};

export const listViajesProveedor = async (
  propietarioIdInput: unknown,
  filters: ListViajesProveedorFilters
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const guideSearchIds = await findGuideSearchIds(propietarioId, filters.search);
  const where = buildWhere(propietarioId, filters, guideSearchIds);
  const orderBy = [
    { fecha_salida: 'desc' },
    { id: 'desc' }
  ] satisfies Prisma.ViajeProveedorOrderByWithRelationInput[];
  const pagination = parsePagination(filters as Record<string, unknown>);

  if (!pagination) {
    return prisma.viajeProveedor.findMany({
      where,
      include: includeRelations,
      orderBy
    });
  }

  const [data, total] = await prisma.$transaction([
    prisma.viajeProveedor.findMany({
      where,
      include: includeRelations,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit
    }),
    prisma.viajeProveedor.count({ where })
  ]);

  return buildPaginatedResult(data, total, pagination);
};

const monthNames = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
];

const parseYearFilter = (value: unknown) => {
  const year = value === undefined || value === null || value === '' ? new Date().getUTCFullYear() : Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError('anio debe estar entre 2000 y 2100', 400);
  }
  return year;
};

const parseMonthList = (value: unknown) => {
  const currentMonth = new Date().getUTCMonth() + 1;
  const rawValues = Array.isArray(value) ? value : String(value ?? currentMonth).split(',');
  const months = [...new Set(rawValues.map((item) => Number(item)).filter((item) => Number.isInteger(item)))];

  if (!months.length || months.some((month) => month < 1 || month > 12)) {
    throw new AppError('meses debe contener valores entre 1 y 12', 400);
  }

  return months.sort((a, b) => a - b);
};

const parseIdList = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === '') return [];
  const rawValues = Array.isArray(value) ? value : String(value).split(',');
  return rawValues
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => parseBigIntId(item, field));
};

const monthRangeWhere = (year: number, months: number[]) => ({
  OR: months.map((month) => ({
    fecha_salida: {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(year, month, 1))
    }
  }))
});

type ResumenGroupItem = {
  id: string;
  nombre: string;
  ruc_cedula: string;
};

const emptyResumenTotals = () => ({
  precio_viaje: new Prisma.Decimal(0),
  valor_a_facturar: new Prisma.Decimal(0),
  precio_pagar_proveedor: new Prisma.Decimal(0),
  viaticos: new Prisma.Decimal(0),
  utilidad: new Prisma.Decimal(0),
  pendientes_cobro: 0,
  pendientes_pago: 0
});

const addResumenTotals = (
  totals: ReturnType<typeof emptyResumenTotals>,
  viaje: {
    precio_viaje: Prisma.Decimal;
    valor_a_facturar: Prisma.Decimal;
    precio_pagar_proveedor: Prisma.Decimal;
    viaticos: Prisma.Decimal;
    utilidad: Prisma.Decimal;
    cobrado: boolean;
    pagado_proveedor: boolean;
  }
) => {
  totals.precio_viaje = totals.precio_viaje.plus(viaje.precio_viaje);
  totals.valor_a_facturar = totals.valor_a_facturar.plus(viaje.valor_a_facturar);
  totals.precio_pagar_proveedor = totals.precio_pagar_proveedor.plus(viaje.precio_pagar_proveedor);
  totals.viaticos = totals.viaticos.plus(viaje.viaticos);
  totals.utilidad = totals.utilidad.plus(viaje.utilidad);
  if (!viaje.cobrado) totals.pendientes_cobro += 1;
  if (!viaje.pagado_proveedor) totals.pendientes_pago += 1;
};

export const getResumenViajesProveedor = async (
  propietarioIdInput: unknown,
  filters: ResumenViajesProveedorFilters
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const anio = parseYearFilter(filters.anio);
  const meses = parseMonthList(filters.meses);
  const proveedorIds = parseIdList(filters.proveedor_ids, 'proveedor_ids');
  const where: Prisma.ViajeProveedorWhereInput = {
    propietario_id: propietarioId,
    estado: { not: EstadoViaje.CANCELADO },
    AND: [monthRangeWhere(anio, meses)]
  };

  if (proveedorIds.length) {
    where.proveedor_id = { in: proveedorIds };
  }

  const viajes = await prisma.viajeProveedor.findMany({
    where,
    include: {
      cliente: true,
      proveedor: true
    },
    orderBy: [{ fecha_salida: 'asc' }, { id: 'asc' }]
  });

  const resumenTotals = emptyResumenTotals();
  const clientes = new Map<
    string,
    { cliente: ResumenGroupItem; cantidad_viajes: number; totales: ReturnType<typeof emptyResumenTotals> }
  >();
  const proveedores = new Map<
    string,
    { proveedor: ResumenGroupItem; cantidad_viajes: number; totales: ReturnType<typeof emptyResumenTotals> }
  >();

  for (const viaje of viajes) {
    addResumenTotals(resumenTotals, viaje);

    const clienteKey = String(viaje.cliente_id);
    if (!clientes.has(clienteKey)) {
      clientes.set(clienteKey, {
        cliente: {
          id: clienteKey,
          nombre: viaje.cliente.nombre,
          ruc_cedula: viaje.cliente.ruc_cedula
        },
        cantidad_viajes: 0,
        totales: emptyResumenTotals()
      });
    }
    const clienteGroup = clientes.get(clienteKey)!;
    clienteGroup.cantidad_viajes += 1;
    addResumenTotals(clienteGroup.totales, viaje);

    const proveedorKey = String(viaje.proveedor_id);
    if (!proveedores.has(proveedorKey)) {
      proveedores.set(proveedorKey, {
        proveedor: {
          id: proveedorKey,
          nombre: viaje.proveedor.nombre,
          ruc_cedula: viaje.proveedor.ruc_cedula
        },
        cantidad_viajes: 0,
        totales: emptyResumenTotals()
      });
    }
    const proveedorGroup = proveedores.get(proveedorKey)!;
    proveedorGroup.cantidad_viajes += 1;
    addResumenTotals(proveedorGroup.totales, viaje);
  }

  return {
    periodo: {
      anio,
      meses: meses.map((month) => ({
        numero: month,
        label: monthNames[month - 1],
        fecha_inicio: new Date(Date.UTC(anio, month - 1, 1)),
        fecha_fin: new Date(Date.UTC(anio, month, 0))
      }))
    },
    resumen: {
      cantidad_viajes: viajes.length,
      cantidad_clientes: clientes.size,
      cantidad_proveedores: proveedores.size,
      totales: resumenTotals
    },
    clientes: [...clientes.values()].sort((a, b) =>
      b.totales.valor_a_facturar.comparedTo(a.totales.valor_a_facturar)
    ),
    proveedores: [...proveedores.values()].sort((a, b) =>
      b.totales.precio_pagar_proveedor.comparedTo(a.totales.precio_pagar_proveedor)
    )
  };
};

export const getViajeProveedorById = async (propietarioIdInput: unknown, idInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const viaje = await prisma.viajeProveedor.findFirst({
    where: {
      id,
      propietario_id: propietarioId
    },
    include: includeRelations
  });

  if (!viaje) {
    throw new AppError('Viaje de proveedor no encontrado', 404);
  }

  return viaje;
};

export const createViajeProveedor = async (
  propietarioIdInput: unknown,
  input: ViajeProveedorCreateInput,
  audit?: AuditContext
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const clienteId = parseBigIntId(input.cliente_id, 'cliente_id');
  const proveedorId = parseBigIntId(input.proveedor_id, 'proveedor_id');
  const tarifaRutaId = parseBigIntId(input.tarifa_ruta_id, 'tarifa_ruta_id');
  const fechaSalida = toDateOnly(input.fecha_salida) ?? todayDateOnly();
  const fechaLlegada = toDateOnly(input.fecha_llegada);

  assertFechaLlegadaValida(fechaSalida, fechaLlegada);

  const [cliente, proveedor] = await Promise.all([
    getClienteForWrite(propietarioId, clienteId),
    getProveedorForWrite(propietarioId, proveedorId)
  ]);
  const tarifaRuta = await getTarifaRutaForWrite(propietarioId, tarifaRutaId, fechaSalida);
  const precioViaje = toMoney(input.precio_viaje ?? tarifaRuta.precio);
  const valorAFacturar =
    input.valor_a_facturar === undefined
      ? calculateValorAFacturar(precioViaje, cliente.porcentaje_comision)
      : toMoney(input.valor_a_facturar);
  const precioPagarProveedor =
    input.precio_pagar_proveedor === undefined
      ? calculatePrecioPagarProveedor(valorAFacturar, proveedor.porcentaje_utilidad)
      : toMoney(input.precio_pagar_proveedor);
  const viaticos = toMoney(input.viaticos ?? 0);
  const cobrado = input.cobrado ?? false;
  const pagadoProveedor = input.pagado_proveedor ?? false;
  const cobroSupport = resolveSoporteOperacion(cobrado, input.soporte_cobro, input.sin_factura_cobro);
  const pagoSupport = resolveSoporteOperacion(
    pagadoProveedor,
    input.soporte_pago_proveedor,
    input.proveedor_sin_factura
  );

  const viaje = await prisma.viajeProveedor.create({
    data: {
      propietario_id: propietarioId,
      cliente_id: clienteId,
      proveedor_id: proveedorId,
      tarifa_ruta_id: tarifaRutaId,
      fecha_salida: fechaSalida,
      fecha_llegada: fechaLlegada,
      descripcion_carga: input.descripcion_carga,
      numeros_guia_remision: input.numeros_guia_remision,
      precio_viaje: precioViaje,
      valor_a_facturar: valorAFacturar,
      precio_pagar_proveedor: precioPagarProveedor,
      viaticos,
      utilidad: calculateUtilidad(valorAFacturar, precioPagarProveedor, viaticos),
      cobrado,
      fecha_cobro: resolveFechaOperacion(cobrado, input.fecha_cobro),
      soporte_cobro: cobroSupport.soporte,
      sin_factura_cobro: cobroSupport.sinFactura,
      pagado_proveedor: pagadoProveedor,
      fecha_pago_proveedor: resolveFechaOperacion(
        pagadoProveedor,
        input.fecha_pago_proveedor
      ),
      soporte_pago_proveedor: pagoSupport.soporte,
      proveedor_sin_factura: pagoSupport.sinFactura,
      estado: toPrismaEstadoViajeProveedor(input.estado) ?? EstadoViaje.PROGRAMADO,
      observaciones: input.observaciones
    },
    include: includeRelations
  });

  await recordAuditEvent({
    ...audit,
    propietarioId: propietarioIdInput,
    entidad: 'viaje_proveedor',
    entidadId: viaje.id,
    accion: 'crear',
    resumen: `Viaje proveedor creado ${viaje.tarifa_ruta.ruta.origen} - ${viaje.tarifa_ruta.ruta.destino}`,
    despues: viaje
  });

  return viaje;
};

export const updateViajeProveedor = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ViajeProveedorUpdateInput,
  audit?: AuditContext
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getViajeProveedorById(propietarioId, id);

  const clienteId = input.cliente_id
    ? parseBigIntId(input.cliente_id, 'cliente_id')
    : current.cliente_id;
  const proveedorId = input.proveedor_id
    ? parseBigIntId(input.proveedor_id, 'proveedor_id')
    : current.proveedor_id;
  const tarifaRutaId = input.tarifa_ruta_id
    ? parseBigIntId(input.tarifa_ruta_id, 'tarifa_ruta_id')
    : current.tarifa_ruta_id;
  const fechaSalida = input.fecha_salida
    ? toDateOnly(input.fecha_salida)!
    : current.fecha_salida;
  const fechaLlegada = Object.hasOwn(input, 'fecha_llegada')
    ? toDateOnly(input.fecha_llegada)
    : current.fecha_llegada;

  assertFechaLlegadaValida(fechaSalida, fechaLlegada);

  const cliente = input.cliente_id
    ? await getClienteForWrite(propietarioId, clienteId)
    : current.cliente;
  const proveedor = input.proveedor_id
    ? await getProveedorForWrite(propietarioId, proveedorId)
    : current.proveedor;

  const tarifaRuta = input.tarifa_ruta_id
    ? await getTarifaRutaForWrite(propietarioId, tarifaRutaId, fechaSalida)
    : current.tarifa_ruta;

  assertTarifaVigente(tarifaRuta, fechaSalida);

  const shouldRecalculateValor =
    input.precio_viaje !== undefined || input.cliente_id !== undefined || input.tarifa_ruta_id !== undefined;
  const shouldRecalculatePago =
    shouldRecalculateValor || input.valor_a_facturar !== undefined || input.proveedor_id !== undefined;
  const precioViaje =
    input.precio_viaje !== undefined
      ? toMoney(input.precio_viaje)
      : input.tarifa_ruta_id !== undefined
        ? toMoney(tarifaRuta.precio)
        : current.precio_viaje;
  const valorAFacturar =
    input.valor_a_facturar !== undefined
      ? toMoney(input.valor_a_facturar)
      : shouldRecalculateValor
        ? calculateValorAFacturar(precioViaje, cliente.porcentaje_comision)
        : current.valor_a_facturar;
  const precioPagarProveedor =
    input.precio_pagar_proveedor !== undefined
      ? toMoney(input.precio_pagar_proveedor)
      : shouldRecalculatePago
        ? calculatePrecioPagarProveedor(valorAFacturar, proveedor.porcentaje_utilidad)
        : current.precio_pagar_proveedor;
  const viaticos = input.viaticos !== undefined ? toMoney(input.viaticos) : current.viaticos;
  const cobrado = Object.hasOwn(input, 'cobrado') ? input.cobrado! : current.cobrado;
  const pagadoProveedor = Object.hasOwn(input, 'pagado_proveedor')
    ? input.pagado_proveedor!
    : current.pagado_proveedor;
  const cobroSupport =
    Object.hasOwn(input, 'cobrado') ||
    Object.hasOwn(input, 'soporte_cobro') ||
    Object.hasOwn(input, 'sin_factura_cobro')
      ? resolveSoporteOperacion(cobrado, input.soporte_cobro, input.sin_factura_cobro, {
          soporte: current.soporte_cobro,
          sinFactura: current.sin_factura_cobro
        })
      : undefined;
  const pagoSupport =
    Object.hasOwn(input, 'pagado_proveedor') ||
    Object.hasOwn(input, 'soporte_pago_proveedor') ||
    Object.hasOwn(input, 'proveedor_sin_factura')
      ? resolveSoporteOperacion(
          pagadoProveedor,
          input.soporte_pago_proveedor,
          input.proveedor_sin_factura,
          {
            soporte: current.soporte_pago_proveedor,
            sinFactura: current.proveedor_sin_factura
          }
        )
      : undefined;

  const viaje = await prisma.viajeProveedor.update({
    where: { id },
    data: {
      cliente_id: input.cliente_id ? clienteId : undefined,
      proveedor_id: input.proveedor_id ? proveedorId : undefined,
      tarifa_ruta_id: input.tarifa_ruta_id ? tarifaRutaId : undefined,
      fecha_salida: input.fecha_salida ? fechaSalida : undefined,
      fecha_llegada: Object.hasOwn(input, 'fecha_llegada') ? fechaLlegada : undefined,
      descripcion_carga: Object.hasOwn(input, 'descripcion_carga')
        ? input.descripcion_carga
        : undefined,
      numeros_guia_remision: Object.hasOwn(input, 'numeros_guia_remision')
        ? input.numeros_guia_remision
        : undefined,
      precio_viaje: precioViaje,
      valor_a_facturar: valorAFacturar,
      precio_pagar_proveedor: precioPagarProveedor,
      viaticos,
      utilidad: calculateUtilidad(valorAFacturar, precioPagarProveedor, viaticos),
      cobrado: Object.hasOwn(input, 'cobrado') ? cobrado : undefined,
      fecha_cobro:
        Object.hasOwn(input, 'cobrado') || Object.hasOwn(input, 'fecha_cobro')
          ? resolveFechaOperacion(cobrado, input.fecha_cobro, current.fecha_cobro)
          : undefined,
      soporte_cobro: cobroSupport?.soporte,
      sin_factura_cobro: cobroSupport?.sinFactura,
      pagado_proveedor: Object.hasOwn(input, 'pagado_proveedor') ? pagadoProveedor : undefined,
      fecha_pago_proveedor:
        Object.hasOwn(input, 'pagado_proveedor') || Object.hasOwn(input, 'fecha_pago_proveedor')
          ? resolveFechaOperacion(
              pagadoProveedor,
              input.fecha_pago_proveedor,
              current.fecha_pago_proveedor
            )
          : undefined,
      soporte_pago_proveedor: pagoSupport?.soporte,
      proveedor_sin_factura: pagoSupport?.sinFactura,
      estado: toPrismaEstadoViajeProveedor(input.estado),
      observaciones: Object.hasOwn(input, 'observaciones') ? input.observaciones : undefined
    },
    include: includeRelations
  });

  await recordAuditEvent({
    ...audit,
    propietarioId: propietarioIdInput,
    entidad: 'viaje_proveedor',
    entidadId: viaje.id,
    accion: 'actualizar',
    resumen: `Viaje proveedor actualizado ${viaje.tarifa_ruta.ruta.origen} - ${viaje.tarifa_ruta.ruta.destino}`,
    antes: current,
    despues: viaje
  });

  return viaje;
};

export const updateEstadoViajeProveedor = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ViajeProveedorEstadoInput,
  audit?: AuditContext
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getViajeProveedorById(propietarioId, id);

  const viaje = await prisma.viajeProveedor.update({
    where: { id },
    data: {
      estado: toPrismaEstadoViajeProveedor(input.estado)
    },
    include: includeRelations
  });

  await recordAuditEvent({
    ...audit,
    propietarioId: propietarioIdInput,
    entidad: 'viaje_proveedor',
    entidadId: viaje.id,
    accion: 'cambiar_estado',
    resumen: `Estado de viaje proveedor cambiado a ${input.estado}`,
    antes: { estado: current.estado },
    despues: { estado: viaje.estado }
  });

  return viaje;
};

export const updateCobroViajeProveedor = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ViajeProveedorCobroInput,
  audit?: AuditContext
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getViajeProveedorById(propietarioId, id);
  const cobroSupport = resolveSoporteOperacion(
    input.cobrado,
    input.soporte_cobro,
    input.sin_factura_cobro,
    {
      soporte: current.soporte_cobro,
      sinFactura: current.sin_factura_cobro
    }
  );

  const viaje = await prisma.viajeProveedor.update({
    where: { id },
    data: {
      cobrado: input.cobrado,
      fecha_cobro: resolveFechaOperacion(input.cobrado, input.fecha_cobro, current.fecha_cobro),
      soporte_cobro: cobroSupport.soporte,
      sin_factura_cobro: cobroSupport.sinFactura
    },
    include: includeRelations
  });

  await recordAuditEvent({
    ...audit,
    propietarioId: propietarioIdInput,
    entidad: 'viaje_proveedor',
    entidadId: viaje.id,
    accion: input.cobrado ? 'marcar_cobrado' : 'marcar_no_cobrado',
    resumen: input.cobrado ? 'Viaje proveedor marcado como cobrado' : 'Viaje proveedor marcado como no cobrado',
    antes: {
      cobrado: current.cobrado,
      fecha_cobro: current.fecha_cobro,
      soporte_cobro: current.soporte_cobro,
      sin_factura_cobro: current.sin_factura_cobro
    },
    despues: {
      cobrado: viaje.cobrado,
      fecha_cobro: viaje.fecha_cobro,
      soporte_cobro: viaje.soporte_cobro,
      sin_factura_cobro: viaje.sin_factura_cobro
    }
  });

  return viaje;
};

export const updatePagoViajeProveedor = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ViajeProveedorPagoInput,
  audit?: AuditContext
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getViajeProveedorById(propietarioId, id);
  const pagoSupport = resolveSoporteOperacion(
    input.pagado_proveedor,
    input.soporte_pago_proveedor,
    input.proveedor_sin_factura,
    {
      soporte: current.soporte_pago_proveedor,
      sinFactura: current.proveedor_sin_factura
    }
  );

  const viaje = await prisma.viajeProveedor.update({
    where: { id },
    data: {
      pagado_proveedor: input.pagado_proveedor,
      fecha_pago_proveedor: resolveFechaOperacion(
        input.pagado_proveedor,
        input.fecha_pago_proveedor,
        current.fecha_pago_proveedor
      ),
      soporte_pago_proveedor: pagoSupport.soporte,
      proveedor_sin_factura: pagoSupport.sinFactura
    },
    include: includeRelations
  });

  await recordAuditEvent({
    ...audit,
    propietarioId: propietarioIdInput,
    entidad: 'viaje_proveedor',
    entidadId: viaje.id,
    accion: 'marcar_pagado_proveedor',
    resumen: 'Viaje proveedor marcado como pagado',
    antes: {
      pagado_proveedor: current.pagado_proveedor,
      fecha_pago_proveedor: current.fecha_pago_proveedor,
      soporte_pago_proveedor: current.soporte_pago_proveedor,
      proveedor_sin_factura: current.proveedor_sin_factura
    },
    despues: {
      pagado_proveedor: viaje.pagado_proveedor,
      fecha_pago_proveedor: viaje.fecha_pago_proveedor,
      soporte_pago_proveedor: viaje.soporte_pago_proveedor,
      proveedor_sin_factura: viaje.proveedor_sin_factura
    }
  });

  return viaje;
};

export const addGuiasViajeProveedor = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ViajeProveedorGuiasInput,
  audit?: AuditContext
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getViajeProveedorById(propietarioId, id);
  const guias = [...current.numeros_guia_remision];

  for (const guia of input.numeros_guia_remision) {
    if (!guias.includes(guia)) {
      guias.push(guia);
    }
  }

  const viaje = await prisma.viajeProveedor.update({
    where: { id },
    data: {
      numeros_guia_remision: guias
    },
    include: includeRelations
  });

  await recordAuditEvent({
    ...audit,
    propietarioId: propietarioIdInput,
    entidad: 'viaje_proveedor',
    entidadId: viaje.id,
    accion: 'agregar_guias',
    resumen: `Guias agregadas: ${input.numeros_guia_remision.join(', ')}`,
    antes: { numeros_guia_remision: current.numeros_guia_remision },
    despues: { numeros_guia_remision: viaje.numeros_guia_remision }
  });

  return viaje;
};

export const cancelViajeProveedor = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  audit?: AuditContext
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getViajeProveedorById(propietarioId, id);

  if (current.estado === EstadoViaje.CANCELADO) {
    await prisma.viajeProveedor.delete({
      where: { id }
    });

    await recordAuditEvent({
      ...audit,
      propietarioId: propietarioIdInput,
      entidad: 'viaje_proveedor',
      entidadId: current.id,
      accion: 'eliminar',
      resumen: 'Viaje proveedor eliminado definitivamente',
      antes: current,
      despues: null
    });

    return current;
  }

  const viaje = await prisma.viajeProveedor.update({
    where: { id },
    data: {
      estado: EstadoViaje.CANCELADO
    },
    include: includeRelations
  });

  await recordAuditEvent({
    ...audit,
    propietarioId: propietarioIdInput,
    entidad: 'viaje_proveedor',
    entidadId: viaje.id,
    accion: 'cancelar',
    resumen: 'Viaje proveedor cancelado',
    antes: { estado: current.estado },
    despues: { estado: viaje.estado }
  });

  return viaje;
};
