import {
  EstadoMantenimiento,
  EstadoVehiculo,
  EstadoViaje,
  Prisma,
  TipoGastoSemanalVehiculo
} from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { parseBigIntId } from '../../utils/ids.js';
import type { ReportExportTable } from '../../utils/report-export.js';
import {
  calculateBonificacion,
  getBonusConfig
} from '../cierres-semanales/cierres-semanales.service.js';
import {
  reporteMantenimientosFiltersSchema,
  reporteUtilidadFiltersSchema,
  reporteViajesFiltersSchema
} from './reportes.schema.js';

const CONFIG_DEFAULTS = {
  alerta_mantenimiento_km_anticipacion: 500
} as const;

const mantenimientoInclude = {
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

type MantenimientoReporte = Prisma.MantenimientoGetPayload<{
  include: typeof mantenimientoInclude;
}>;

const viajeInclude = {
  cliente: true,
  vehiculo: {
    include: {
      categoria_peaje: true
    }
  },
  conductor: true,
  tarifa_ruta: {
    include: {
      ruta: true,
      tipo_carga: true
    }
  }
} satisfies Prisma.ViajeInclude;

type ViajeReporte = Prisma.ViajeGetPayload<{
  include: typeof viajeInclude;
}>;

const utilidadViajeInclude = {
  cliente: true,
  vehiculo: {
    include: {
      categoria_peaje: true
    }
  },
  conductor: true,
  tarifa_ruta: {
    include: {
      ruta: true,
      tipo_carga: true
    }
  },
  gastos_viaje: {
    include: {
      tipo_gasto: true
    },
    orderBy: { id: 'asc' }
  }
} satisfies Prisma.ViajeInclude;

type ViajeUtilidadReporte = Prisma.ViajeGetPayload<{
  include: typeof utilidadViajeInclude;
}>;

const gastoSemanalUtilidadInclude = {
  vehiculo: true,
  conductor: true
} satisfies Prisma.GastoSemanalVehiculoInclude;

type GastoSemanalUtilidad = Prisma.GastoSemanalVehiculoGetPayload<{
  include: typeof gastoSemanalUtilidadInclude;
}>;

const prismaToApiEstadoVehiculo = {
  [EstadoVehiculo.DISPONIBLE]: 'disponible',
  [EstadoVehiculo.EN_VIAJE]: 'en_viaje',
  [EstadoVehiculo.EN_MANTENIMIENTO]: 'en_mantenimiento',
  [EstadoVehiculo.INACTIVO]: 'inactivo'
};

const prismaToApiEstadoMantenimiento = {
  [EstadoMantenimiento.PROGRAMADO]: 'programado',
  [EstadoMantenimiento.REALIZADO]: 'realizado',
  [EstadoMantenimiento.CANCELADO]: 'cancelado',
  [EstadoMantenimiento.VENCIDO]: 'vencido'
};

const prismaToApiEstadoViaje = {
  [EstadoViaje.PROGRAMADO]: 'programado',
  [EstadoViaje.EN_CURSO]: 'en_curso',
  [EstadoViaje.COMPLETADO]: 'completado',
  [EstadoViaje.CANCELADO]: 'cancelado'
};

const apiToPrismaEstadoMantenimiento = {
  programado: EstadoMantenimiento.PROGRAMADO,
  realizado: EstadoMantenimiento.REALIZADO,
  cancelado: EstadoMantenimiento.CANCELADO,
  vencido: EstadoMantenimiento.VENCIDO
};

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const diffDays = (from: Date, to: Date) => {
  const millis = to.getTime() - from.getTime();
  return Math.ceil(millis / 86_400_000);
};

const toMoney = (value: number | string | Prisma.Decimal | null | undefined) => {
  return new Prisma.Decimal(value ?? 0).toDecimalPlaces(2);
};

const addMoney = (
  left: number | string | Prisma.Decimal | null | undefined,
  right: number | string | Prisma.Decimal | null | undefined
) => {
  return toMoney(left).plus(toMoney(right)).toDecimalPlaces(2);
};

const subtractMoney = (
  left: number | string | Prisma.Decimal | null | undefined,
  right: number | string | Prisma.Decimal | null | undefined
) => {
  return toMoney(left).minus(toMoney(right)).toDecimalPlaces(2);
};

const normalizeText = (value: unknown) => {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
};

const isRetornoGastoViaje = (value: unknown) => normalizeText(value) === 'RETORNO';

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

const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const dateOnlyString = (date: Date) => date.toISOString().slice(0, 10);

const utcDate = (year: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(year, monthIndex, day));

const addDaysUtc = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const isoWeekInfo = (dateInput: Date) => {
  const date = utcDate(
    dateInput.getUTCFullYear(),
    dateInput.getUTCMonth(),
    dateInput.getUTCDate()
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const anio = date.getUTCFullYear();
  const yearStart = utcDate(anio, 0, 1);
  const numeroSemana = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);

  return { anio, numero_semana: numeroSemana };
};

const isoWeekRange = (anio: number, numeroSemana: number) => {
  const jan4 = utcDate(anio, 0, 4);
  const jan4Day = jan4.getUTCDay() || 7;
  const weekOneStart = addDaysUtc(jan4, 1 - jan4Day);
  const fechaInicio = addDaysUtc(weekOneStart, (numeroSemana - 1) * 7);

  return {
    fecha_inicio: fechaInicio,
    fecha_fin: addDaysUtc(fechaInicio, 6)
  };
};

const weekKey = (anio: number, numeroSemana: number) => `${anio}-${numeroSemana}`;

const dominantMonthForWeek = (fechaInicio: Date) => {
  const counts = new Map<string, { anio: number; mes: number; dias: number }>();

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDaysUtc(fechaInicio, offset);
    const anio = date.getUTCFullYear();
    const mes = date.getUTCMonth() + 1;
    const key = `${anio}-${mes}`;
    const current = counts.get(key) ?? { anio, mes, dias: 0 };
    current.dias += 1;
    counts.set(key, current);
  }

  return [...counts.values()].sort((left, right) => right.dias - left.dias)[0];
};

const selectedWeeksForMonths = (anio: number, meses: number[]) => {
  const selectedMonths = new Set(meses);
  const weeks = new Map<
    string,
    {
      anio: number;
      numero_semana: number;
      fecha_inicio: Date;
      fecha_fin: Date;
      mes: number;
      mes_label: string;
    }
  >();

  for (const mes of selectedMonths) {
    const firstDay = utcDate(anio, mes - 1, 1);
    const lastDay = utcDate(anio, mes, 0);

    for (
      let date = addDaysUtc(firstDay, -7);
      date <= addDaysUtc(lastDay, 7);
      date = addDaysUtc(date, 1)
    ) {
      const info = isoWeekInfo(date);
      const key = weekKey(info.anio, info.numero_semana);
      if (weeks.has(key)) continue;

      const range = isoWeekRange(info.anio, info.numero_semana);
      const dominant = dominantMonthForWeek(range.fecha_inicio);

      if (dominant?.anio !== anio || !selectedMonths.has(dominant.mes)) continue;

      weeks.set(key, {
        anio: info.anio,
        numero_semana: info.numero_semana,
        fecha_inicio: range.fecha_inicio,
        fecha_fin: range.fecha_fin,
        mes: dominant.mes,
        mes_label: monthNames[dominant.mes - 1] ?? `Mes ${dominant.mes}`
      });
    }
  }

  return [...weeks.values()].sort((left, right) => left.fecha_inicio.getTime() - right.fecha_inicio.getTime());
};

const viajeFechaReporte = (viaje: { fecha_salida: Date; fecha_llegada: Date | null }) =>
  viaje.fecha_llegada ?? viaje.fecha_salida;

const viajeUtilidad = (viaje: { precio_real_flete: Prisma.Decimal; costo_real_gastos: Prisma.Decimal | null }) =>
  toMoney(viaje.precio_real_flete).minus(toMoney(viaje.costo_real_gastos)).toDecimalPlaces(2);

const createReporteViajesTotales = () => ({
  precio_viaje: toMoney(0),
  valor_facturar: toMoney(0),
  utilidad_viajes: toMoney(0),
  mantenimientos: toMoney(0),
  utilidad: toMoney(0)
});

const addReporteViajeTotales = (
  totals: ReturnType<typeof createReporteViajesTotales>,
  viaje: Pick<ViajeReporte, 'precio_flete' | 'precio_real_flete' | 'costo_real_gastos'>
) => {
  const utilidad = viajeUtilidad(viaje);
  totals.precio_viaje = addMoney(totals.precio_viaje, viaje.precio_flete);
  totals.valor_facturar = addMoney(totals.valor_facturar, viaje.precio_real_flete);
  totals.utilidad_viajes = addMoney(totals.utilidad_viajes, utilidad);
  totals.utilidad = addMoney(totals.utilidad, utilidad);
};

const addReporteMantenimientoTotales = (
  totals: ReturnType<typeof createReporteViajesTotales>,
  costoTotal: number | string | Prisma.Decimal | null | undefined
) => {
  const costo = toMoney(costoTotal);
  totals.mantenimientos = addMoney(totals.mantenimientos, costo);
  totals.utilidad = toMoney(totals.utilidad).minus(costo).toDecimalPlaces(2);
};

const formatReporteViaje = (
  viaje: ViajeReporte,
  semana: ReturnType<typeof selectedWeeksForMonths>[number]
) => ({
  id: viaje.id,
  fecha: viajeFechaReporte(viaje),
  fecha_salida: viaje.fecha_salida,
  fecha_llegada: viaje.fecha_llegada,
  mes: semana.mes,
  mes_label: semana.mes_label,
  semana_anio: semana.anio,
  numero_semana: semana.numero_semana,
  semana_label: `Sem ${semana.numero_semana}`,
  cliente: {
    id: viaje.cliente.id,
    nombre: viaje.cliente.nombre,
    ruc_cedula: viaje.cliente.ruc_cedula
  },
  vehiculo: {
    id: viaje.vehiculo.id,
    placa: viaje.vehiculo.placa,
    marca: viaje.vehiculo.marca,
    modelo: viaje.vehiculo.modelo
  },
  conductor: {
    id: viaje.conductor.id,
    nombre: viaje.conductor.nombre,
    cedula: viaje.conductor.cedula
  },
  ruta: {
    id: viaje.tarifa_ruta.ruta.id,
    origen: viaje.tarifa_ruta.ruta.origen,
    destino: viaje.tarifa_ruta.ruta.destino
  },
  numeros_guia_remision: viaje.numeros_guia_remision,
  precio_viaje: viaje.precio_flete,
  valor_facturar: viaje.precio_real_flete,
  viaticos: toMoney(viaje.costo_real_gastos),
  utilidad: viajeUtilidad(viaje),
  cobrado: viaje.cobrado,
  retorno: viaje.retorno,
  estado: prismaToApiEstadoViaje[viaje.estado]
});

export const getReporteViajes = async (propietarioIdInput: unknown, input: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const filters = reporteViajesFiltersSchema.parse(input);
  const meses = filters.meses?.length ? filters.meses : allMonths;
  const semanasFiltradas = filters.semanas?.length ? new Set(filters.semanas) : null;
  const semanas = selectedWeeksForMonths(filters.anio, meses).filter(
    (semana) => !semanasFiltradas || semanasFiltradas.has(semana.numero_semana)
  );

  if (!semanas.length) {
    return {
      filtros: {
        anio: filters.anio,
        meses,
        semanas: filters.semanas ?? [],
        vehiculo_ids: filters.vehiculo_ids ?? [],
        cliente_ids: filters.cliente_ids ?? [],
        cobrado: filters.cobrado ?? null,
        search: filters.search ?? null
      },
      semanas: [],
      resumen: {
        cantidad_viajes: 0,
        cantidad_mantenimientos: 0,
        cantidad_vehiculos: 0,
        cantidad_clientes: 0,
        totales: createReporteViajesTotales()
      },
      meses: [],
      items: []
    };
  }

  const firstWeek = semanas[0]!;
  const lastWeek = semanas[semanas.length - 1]!;
  const fechaInicio = firstWeek.fecha_inicio;
  const fechaFin = lastWeek.fecha_fin;
  const vehiculoIds = filters.vehiculo_ids?.map((id) => parseBigIntId(id, 'vehiculo_id'));
  const clienteIds = filters.cliente_ids?.map((id) => parseBigIntId(id, 'cliente_id'));
  const search = filters.search?.trim();
  const searchWhere: Prisma.ViajeWhereInput | undefined = search
    ? {
        OR: [
          { descripcion_carga: { contains: search, mode: 'insensitive' } },
          { observaciones: { contains: search, mode: 'insensitive' } },
          { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
          { cliente: { ruc_cedula: { contains: search, mode: 'insensitive' } } },
          { vehiculo: { placa: { contains: search, mode: 'insensitive' } } },
          { vehiculo: { marca: { contains: search, mode: 'insensitive' } } },
          { vehiculo: { modelo: { contains: search, mode: 'insensitive' } } },
          { conductor: { nombre: { contains: search, mode: 'insensitive' } } },
          { conductor: { cedula: { contains: search, mode: 'insensitive' } } },
          { tarifa_ruta: { ruta: { origen: { contains: search, mode: 'insensitive' } } } },
          { tarifa_ruta: { ruta: { destino: { contains: search, mode: 'insensitive' } } } },
          { numeros_guia_remision: { has: search } }
        ]
      }
    : undefined;
  const viajes = await prisma.viaje.findMany({
    where: {
      propietario_id: propietarioId,
      estado: { not: EstadoViaje.CANCELADO },
      cobrado: filters.cobrado,
      vehiculo_id: vehiculoIds?.length ? { in: vehiculoIds } : undefined,
      cliente_id: clienteIds?.length ? { in: clienteIds } : undefined,
      AND: searchWhere ? [searchWhere] : undefined,
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
    },
    include: viajeInclude,
    orderBy: [{ fecha_llegada: 'desc' }, { fecha_salida: 'desc' }, { vehiculo_id: 'asc' }, { id: 'desc' }]
  });
  const semanasMap = new Map(semanas.map((semana) => [weekKey(semana.anio, semana.numero_semana), semana]));
  const items = viajes
    .map((viaje) => {
      const fecha = viajeFechaReporte(viaje);
      const info = isoWeekInfo(fecha);
      const semana = semanasMap.get(weekKey(info.anio, info.numero_semana));

      return semana ? formatReporteViaje(viaje, semana) : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      if (right.semana_anio !== left.semana_anio) return right.semana_anio - left.semana_anio;
      if (right.numero_semana !== left.numero_semana) return right.numero_semana - left.numero_semana;

      const rightDate = new Date(right.fecha).getTime();
      const leftDate = new Date(left.fecha).getTime();
      if (rightDate !== leftDate) return rightDate - leftDate;

      return String(right.id).localeCompare(String(left.id), undefined, { numeric: true });
    });
  const resumenTotales = createReporteViajesTotales();
  const vehiculos = new Set<string>();
  const clientes = new Set<string>();
  const mesesMap = new Map<
    number,
    {
      mes: number;
      mes_label: string;
      cantidad_viajes: number;
      cantidad_mantenimientos: number;
      totales: ReturnType<typeof createReporteViajesTotales>;
    }
  >();
  const getMonthSummary = (semana: ReturnType<typeof selectedWeeksForMonths>[number]) => {
    const month = mesesMap.get(semana.mes) ?? {
      mes: semana.mes,
      mes_label: semana.mes_label,
      cantidad_viajes: 0,
      cantidad_mantenimientos: 0,
      totales: createReporteViajesTotales()
    };
    mesesMap.set(semana.mes, month);
    return month;
  };

  for (const item of items) {
    vehiculos.add(String(item.vehiculo.id));
    clientes.add(String(item.cliente.id));
    addReporteViajeTotales(resumenTotales, {
      precio_flete: item.precio_viaje,
      precio_real_flete: item.valor_facturar,
      costo_real_gastos: toMoney(item.valor_facturar).minus(toMoney(item.utilidad)).toDecimalPlaces(2)
    });

    const month = getMonthSummary(semanasMap.get(weekKey(item.semana_anio, item.numero_semana))!);
    month.cantidad_viajes += 1;
    month.totales.precio_viaje = addMoney(month.totales.precio_viaje, item.precio_viaje);
    month.totales.valor_facturar = addMoney(month.totales.valor_facturar, item.valor_facturar);
    month.totales.utilidad_viajes = addMoney(month.totales.utilidad_viajes, item.utilidad);
    month.totales.utilidad = addMoney(month.totales.utilidad, item.utilidad);
  }

  const itemVehiculoIds = [...new Set(items.map((item) => item.vehiculo.id))];
  const mantenimientoVehiculoIds = vehiculoIds?.length ? vehiculoIds : itemVehiculoIds;
  const shouldLoadMantenimientos =
    !clienteIds?.length || Boolean(vehiculoIds?.length) || mantenimientoVehiculoIds.length > 0;
  const mantenimientos = shouldLoadMantenimientos
    ? await prisma.mantenimiento.findMany({
        where: {
          propietario_id: propietarioId,
          estado: EstadoMantenimiento.REALIZADO,
          vehiculo_id: mantenimientoVehiculoIds.length ? { in: mantenimientoVehiculoIds } : undefined,
          fecha_mantenimiento: {
            gte: fechaInicio,
            lte: fechaFin
          }
        },
        select: {
          id: true,
          fecha_mantenimiento: true,
          costo_total: true
        }
      })
    : [];

  let cantidadMantenimientos = 0;
  for (const mantenimiento of mantenimientos) {
    const info = isoWeekInfo(mantenimiento.fecha_mantenimiento);
    const semana = semanasMap.get(weekKey(info.anio, info.numero_semana));
    if (!semana) continue;

    cantidadMantenimientos += 1;
    const month = getMonthSummary(semana);
    month.cantidad_mantenimientos += 1;
    addReporteMantenimientoTotales(month.totales, mantenimiento.costo_total);
    addReporteMantenimientoTotales(resumenTotales, mantenimiento.costo_total);
  }

  return {
    filtros: {
      anio: filters.anio,
      meses,
      semanas: filters.semanas ?? [],
      vehiculo_ids: filters.vehiculo_ids ?? [],
      cliente_ids: filters.cliente_ids ?? [],
      cobrado: filters.cobrado ?? null,
      search: filters.search ?? null
    },
    semanas: semanas.map((semana) => ({
      anio: semana.anio,
      numero_semana: semana.numero_semana,
      fecha_inicio: semana.fecha_inicio,
      fecha_fin: semana.fecha_fin,
      mes: semana.mes,
      mes_label: semana.mes_label
    })),
    resumen: {
      cantidad_viajes: items.length,
      cantidad_mantenimientos: cantidadMantenimientos,
      cantidad_vehiculos: vehiculos.size,
      cantidad_clientes: clientes.size,
      totales: resumenTotales
    },
    meses: [...mesesMap.values()].sort((left, right) => left.mes - right.mes),
    items
  };
};

export const buildReporteViajesExportTable = (
  reporte: Awaited<ReturnType<typeof getReporteViajes>>
): ReportExportTable => ({
  title: 'Reporte de viajes',
  subtitle: `Anio ${reporte.filtros.anio} | Meses: ${reporte.meses.map((mes) => mes.mes_label).join(', ') || '-'}`,
  filenameBase: `reporte-viajes-${reporte.filtros.anio}`,
  summary: [
    { label: 'Viajes', value: reporte.resumen.cantidad_viajes },
    { label: 'Vehiculos', value: reporte.resumen.cantidad_vehiculos },
    { label: 'Clientes', value: reporte.resumen.cantidad_clientes },
    { label: 'Precio viaje', value: reporte.resumen.totales.precio_viaje },
    { label: 'A FACTURAR', value: reporte.resumen.totales.valor_facturar },
    { label: 'Utilidad viajes', value: reporte.resumen.totales.utilidad_viajes },
    { label: 'Mantenimientos', value: reporte.resumen.totales.mantenimientos },
    { label: 'Utilidad neta', value: reporte.resumen.totales.utilidad }
  ],
  columns: [
    { key: 'mes', header: 'Mes', width: 14 },
    { key: 'semana', header: 'Semana', width: 10 },
    { key: 'fecha', header: 'Fecha', width: 12 },
    { key: 'placa', header: 'Placa', width: 12 },
    { key: 'cliente', header: 'Cliente', width: 24 },
    { key: 'ruta', header: 'Ruta', width: 28 },
    { key: 'conductor', header: 'Conductor', width: 22 },
    { key: 'guias', header: 'Guias', width: 18 },
    { key: 'precio_viaje', header: 'Precio viaje', width: 14 },
    { key: 'valor_facturar', header: 'A FACTURAR', width: 16 },
    { key: 'viaticos', header: 'Viaticos', width: 14 },
    { key: 'utilidad', header: 'Utilidad viaje', width: 14 },
    { key: 'estado', header: 'Estado', width: 12 }
  ],
  rows: reporte.items.map((item) => ({
    mes: item.mes_label,
    semana: item.numero_semana,
    fecha: item.fecha,
    placa: item.vehiculo.placa,
    cliente: item.cliente.nombre,
    ruta: `${item.ruta.origen} - ${item.ruta.destino}`,
    conductor: item.conductor.nombre,
    guias: item.numeros_guia_remision,
    precio_viaje: item.precio_viaje,
    valor_facturar: item.valor_facturar,
    viaticos: item.viaticos,
    utilidad: item.utilidad,
    estado: item.estado
  }))
});

const createReporteUtilidadTotales = () => ({
  precio_fletes: toMoney(0),
  total_facturado: toMoney(0),
  utilidad_viajes: toMoney(0),
  mantenimientos: toMoney(0),
  sueldos: toMoney(0),
  bonos: toMoney(0),
  ganancia_neta: toMoney(0),
  retornos: toMoney(0),
  domingos: toMoney(0),
  pago_transportistas: toMoney(0)
});

const finalizeReporteUtilidadTotales = (
  totals: ReturnType<typeof createReporteUtilidadTotales>
) => {
  totals.ganancia_neta = subtractMoney(
    subtractMoney(
      subtractMoney(totals.utilidad_viajes, totals.mantenimientos),
      totals.sueldos
    ),
    totals.bonos
  );
  totals.pago_transportistas = addMoney(
    addMoney(totals.sueldos, totals.bonos),
    addMoney(totals.retornos, totals.domingos)
  );

  return totals;
};

const addReporteUtilidadTotals = (
  target: ReturnType<typeof createReporteUtilidadTotales>,
  source: Partial<ReturnType<typeof createReporteUtilidadTotales>>
) => {
  target.precio_fletes = addMoney(target.precio_fletes, source.precio_fletes);
  target.total_facturado = addMoney(target.total_facturado, source.total_facturado);
  target.utilidad_viajes = addMoney(target.utilidad_viajes, source.utilidad_viajes);
  target.mantenimientos = addMoney(target.mantenimientos, source.mantenimientos);
  target.sueldos = addMoney(target.sueldos, source.sueldos);
  target.bonos = addMoney(target.bonos, source.bonos);
  target.retornos = addMoney(target.retornos, source.retornos);
  target.domingos = addMoney(target.domingos, source.domingos);
};

const buildReporteUtilidadVehiculo = (vehiculo: {
  id: bigint;
  placa: string;
  marca: string;
  modelo: string | null;
}) => ({
  id: vehiculo.id,
  placa: vehiculo.placa,
  marca: vehiculo.marca,
  modelo: vehiculo.modelo
});

const buildReporteUtilidadConductor = (conductor: {
  id: bigint;
  nombre: string;
  cedula: string;
}) => ({
  id: conductor.id,
  nombre: conductor.nombre,
  cedula: conductor.cedula
});

const buildReporteUtilidadCliente = (cliente: {
  id: bigint;
  nombre: string;
  ruc_cedula: string;
}) => ({
  id: cliente.id,
  nombre: cliente.nombre,
  ruc_cedula: cliente.ruc_cedula
});

const retornoGastosViaje = (viaje: ViajeUtilidadReporte) =>
  viaje.gastos_viaje.reduce(
    (total, gasto) =>
      isRetornoGastoViaje(gasto.tipo_gasto.nombre)
        ? addMoney(total, gasto.monto)
        : total,
    toMoney(0)
  );

const generatedExpenseKey = (
  anio: number,
  numeroSemana: number,
  conductorId: bigint,
  tipo: TipoGastoSemanalVehiculo
) => `${anio}:${numeroSemana}:${conductorId}:${tipo}`;

type SemanaReporte = ReturnType<typeof selectedWeeksForMonths>[number];

type UtilidadVehiculoAsignacion = {
  vehiculo: ReturnType<typeof buildReporteUtilidadVehiculo>;
  cantidad_viajes: number;
  total_fletes: Prisma.Decimal;
};

const selectUtilidadVehiculoAsignado = (vehiculos: Map<string, UtilidadVehiculoAsignacion>) => {
  return [...vehiculos.values()].sort((left, right) => {
    if (right.cantidad_viajes !== left.cantidad_viajes) {
      return right.cantidad_viajes - left.cantidad_viajes;
    }

    const fletesCompare = right.total_fletes.comparedTo(left.total_fletes);
    if (fletesCompare !== 0) return fletesCompare;

    return left.vehiculo.placa.localeCompare(right.vehiculo.placa);
  })[0];
};

export const getReporteUtilidad = async (propietarioIdInput: unknown, input: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const filters = reporteUtilidadFiltersSchema.parse(input);
  const vehiculoId = filters.vehiculo_id
    ? parseBigIntId(filters.vehiculo_id, 'vehiculo_id')
    : undefined;
  const semanas = selectedWeeksForMonths(filters.anio, [filters.mes]);

  if (!semanas.length) {
    return {
      filtros: {
        anio: filters.anio,
        mes: filters.mes,
        vehiculo_id: filters.vehiculo_id ?? null
      },
      periodo: {
        anio: filters.anio,
        mes: filters.mes,
        mes_label: monthNames[filters.mes - 1] ?? `Mes ${filters.mes}`,
        semanas: []
      },
      resumen: {
        cantidad_viajes: 0,
        cantidad_mantenimientos: 0,
        cantidad_vehiculos: 0,
        cantidad_transportistas: 0,
        totales: createReporteUtilidadTotales()
      },
      vehiculos: [],
      clientes: [],
      transportistas: [],
      semanas: []
    };
  }

  const firstWeek = semanas[0]!;
  const lastWeek = semanas[semanas.length - 1]!;
  const fechaInicio = firstWeek.fecha_inicio;
  const fechaFin = lastWeek.fecha_fin;
  const semanasMap = new Map(semanas.map((semana) => [weekKey(semana.anio, semana.numero_semana), semana]));
  const weekConditions = semanas.map((semana) => ({
    anio: semana.anio,
    numero_semana: semana.numero_semana
  }));

  const [config, viajesSource, mantenimientosSource, gastosSemanales] = await Promise.all([
    getBonusConfig(propietarioId),
    prisma.viaje.findMany({
      where: {
        propietario_id: propietarioId,
        estado: { not: EstadoViaje.CANCELADO },
        vehiculo_id: vehiculoId,
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
      },
      include: utilidadViajeInclude,
      orderBy: [{ fecha_llegada: 'asc' }, { fecha_salida: 'asc' }, { vehiculo_id: 'asc' }, { id: 'asc' }]
    }),
    prisma.mantenimiento.findMany({
      where: {
        propietario_id: propietarioId,
        estado: EstadoMantenimiento.REALIZADO,
        vehiculo_id: vehiculoId,
        fecha_mantenimiento: {
          gte: fechaInicio,
          lte: fechaFin
        }
      },
      include: {
        vehiculo: true,
        tipo_mantenimiento: true
      },
      orderBy: [{ fecha_mantenimiento: 'asc' }, { vehiculo_id: 'asc' }, { id: 'asc' }]
    }),
    prisma.gastoSemanalVehiculo.findMany({
      where: {
        propietario_id: propietarioId,
        vehiculo_id: vehiculoId,
        tipo: {
          in: [
            TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR,
            TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR
          ]
        },
        OR: weekConditions
      },
      include: gastoSemanalUtilidadInclude,
      orderBy: [{ anio: 'asc' }, { numero_semana: 'asc' }, { vehiculo_id: 'asc' }, { id: 'asc' }]
    })
  ]);

  const viajes = viajesSource
    .map((viaje) => {
      const fecha = viajeFechaReporte(viaje);
      const info = isoWeekInfo(fecha);
      const semana = semanasMap.get(weekKey(info.anio, info.numero_semana));

      return semana ? { viaje, fecha, semana } : null;
    })
    .filter((item): item is { viaje: ViajeUtilidadReporte; fecha: Date; semana: SemanaReporte } => item !== null);
  const mantenimientos = mantenimientosSource
    .map((mantenimiento) => {
      const info = isoWeekInfo(mantenimiento.fecha_mantenimiento);
      const semana = semanasMap.get(weekKey(info.anio, info.numero_semana));

      return semana ? { mantenimiento, semana } : null;
    })
    .filter((item): item is { mantenimiento: typeof mantenimientosSource[number]; semana: SemanaReporte } => item !== null);

  const resumenTotales = createReporteUtilidadTotales();
  const vehiculos = new Map<
    string,
    {
      vehiculo: ReturnType<typeof buildReporteUtilidadVehiculo>;
      cantidad_viajes: number;
      cantidad_mantenimientos: number;
      totales: ReturnType<typeof createReporteUtilidadTotales>;
    }
  >();
  const semanasResumen = new Map<
    string,
    {
      anio: number;
      numero_semana: number;
      fecha_inicio: Date;
      fecha_fin: Date;
      label: string;
      cantidad_viajes: number;
      cantidad_mantenimientos: number;
      totales: ReturnType<typeof createReporteUtilidadTotales>;
    }
  >();
  const conductoresSemana = new Map<
    string,
    {
      semana: SemanaReporte;
      conductor: ViajeUtilidadReporte['conductor'];
      total_fletes: Prisma.Decimal;
      retorno_gastos: Prisma.Decimal;
      domingo_gastos: Prisma.Decimal;
      cantidad_viajes: number;
      vehiculos: Map<string, UtilidadVehiculoAsignacion>;
    }
  >();
  const transportistas = new Map<
    string,
    {
      conductor: ReturnType<typeof buildReporteUtilidadConductor>;
      cantidad_viajes: number;
      totales: ReturnType<typeof createReporteUtilidadTotales>;
    }
  >();
  const clientes = new Map<
    string,
    {
      cliente: ReturnType<typeof buildReporteUtilidadCliente>;
      cantidad_viajes: number;
      totales: ReturnType<typeof createReporteUtilidadTotales>;
    }
  >();

  const getVehiculoGroup = (vehiculoInput: {
    id: bigint;
    placa: string;
    marca: string;
    modelo: string | null;
  }) => {
    const key = vehiculoInput.id.toString();
    const current = vehiculos.get(key) ?? {
      vehiculo: buildReporteUtilidadVehiculo(vehiculoInput),
      cantidad_viajes: 0,
      cantidad_mantenimientos: 0,
      totales: createReporteUtilidadTotales()
    };
    vehiculos.set(key, current);

    return current;
  };

  const getClienteGroup = (clienteInput: {
    id: bigint;
    nombre: string;
    ruc_cedula: string;
  }) => {
    const key = clienteInput.id.toString();
    const current = clientes.get(key) ?? {
      cliente: buildReporteUtilidadCliente(clienteInput),
      cantidad_viajes: 0,
      totales: createReporteUtilidadTotales()
    };
    clientes.set(key, current);

    return current;
  };

  const getSemanaGroup = (semana: SemanaReporte) => {
    const key = weekKey(semana.anio, semana.numero_semana);
    const current = semanasResumen.get(key) ?? {
      anio: semana.anio,
      numero_semana: semana.numero_semana,
      fecha_inicio: semana.fecha_inicio,
      fecha_fin: semana.fecha_fin,
      label: `Semana ${semana.numero_semana}`,
      cantidad_viajes: 0,
      cantidad_mantenimientos: 0,
      totales: createReporteUtilidadTotales()
    };
    semanasResumen.set(key, current);

    return current;
  };

  const getTransportistaGroup = (conductorInput: {
    id: bigint;
    nombre: string;
    cedula: string;
  }) => {
    const key = conductorInput.id.toString();
    const current = transportistas.get(key) ?? {
      conductor: buildReporteUtilidadConductor(conductorInput),
      cantidad_viajes: 0,
      totales: createReporteUtilidadTotales()
    };
    transportistas.set(key, current);

    return current;
  };

  for (const semana of semanas) {
    getSemanaGroup(semana);
  }

  for (const { viaje, fecha, semana } of viajes) {
    const utilidad = viajeUtilidad(viaje);
    const retornoGastos = retornoGastosViaje(viaje);
    const domingoGastos = fecha.getUTCDay() === 0 ? retornoGastos : toMoney(0);
    const amounts = {
      precio_fletes: viaje.precio_flete,
      total_facturado: viaje.precio_real_flete,
      utilidad_viajes: utilidad,
      retornos: viaje.retorno ? retornoGastos : toMoney(0),
      domingos: domingoGastos
    };
    const vehiculoGroup = getVehiculoGroup(viaje.vehiculo);
    const clienteGroup = getClienteGroup(viaje.cliente);
    const semanaGroup = getSemanaGroup(semana);
    const conductorKey = `${weekKey(semana.anio, semana.numero_semana)}:${viaje.conductor_id}`;
    const conductorSemana = conductoresSemana.get(conductorKey) ?? {
      semana,
      conductor: viaje.conductor,
      total_fletes: toMoney(0),
      retorno_gastos: toMoney(0),
      domingo_gastos: toMoney(0),
      cantidad_viajes: 0,
      vehiculos: new Map<string, UtilidadVehiculoAsignacion>()
    };
    const vehiculoAsignacion = conductorSemana.vehiculos.get(viaje.vehiculo_id.toString()) ?? {
      vehiculo: buildReporteUtilidadVehiculo(viaje.vehiculo),
      cantidad_viajes: 0,
      total_fletes: toMoney(0)
    };

    vehiculoGroup.cantidad_viajes += 1;
    clienteGroup.cantidad_viajes += 1;
    semanaGroup.cantidad_viajes += 1;
    addReporteUtilidadTotals(resumenTotales, amounts);
    addReporteUtilidadTotals(vehiculoGroup.totales, amounts);
    addReporteUtilidadTotals(clienteGroup.totales, amounts);
    addReporteUtilidadTotals(semanaGroup.totales, amounts);

    conductorSemana.cantidad_viajes += 1;
    conductorSemana.total_fletes = addMoney(conductorSemana.total_fletes, viaje.precio_flete);
    conductorSemana.retorno_gastos = addMoney(
      conductorSemana.retorno_gastos,
      viaje.retorno ? retornoGastos : toMoney(0)
    );
    conductorSemana.domingo_gastos = addMoney(conductorSemana.domingo_gastos, domingoGastos);
    vehiculoAsignacion.cantidad_viajes += 1;
    vehiculoAsignacion.total_fletes = addMoney(vehiculoAsignacion.total_fletes, viaje.precio_flete);
    conductorSemana.vehiculos.set(viaje.vehiculo_id.toString(), vehiculoAsignacion);
    conductoresSemana.set(conductorKey, conductorSemana);
  }

  for (const { mantenimiento, semana } of mantenimientos) {
    const amounts = { mantenimientos: mantenimiento.costo_total };
    const vehiculoGroup = getVehiculoGroup(mantenimiento.vehiculo);
    const semanaGroup = getSemanaGroup(semana);

    vehiculoGroup.cantidad_mantenimientos += 1;
    semanaGroup.cantidad_mantenimientos += 1;
    addReporteUtilidadTotals(resumenTotales, amounts);
    addReporteUtilidadTotals(vehiculoGroup.totales, amounts);
    addReporteUtilidadTotals(semanaGroup.totales, amounts);
  }

  const gastosGeneradosPorConductor = new Map<
    string,
    {
      gasto: GastoSemanalUtilidad;
      monto: Prisma.Decimal;
    }
  >();

  for (const gasto of gastosSemanales) {
    if (!gasto.conductor_id) continue;

    const key = generatedExpenseKey(
      gasto.anio,
      gasto.numero_semana,
      gasto.conductor_id,
      gasto.tipo
    );
    const current = gastosGeneradosPorConductor.get(key) ?? {
      gasto,
      monto: toMoney(0)
    };
    current.monto = addMoney(current.monto, gasto.monto);
    gastosGeneradosPorConductor.set(key, current);
  }

  const processedGeneratedKeys = new Set<string>();

  for (const conductorSemana of conductoresSemana.values()) {
    const week = conductorSemana.semana;
    const assignedVehicle = selectUtilidadVehiculoAsignado(conductorSemana.vehiculos)?.vehiculo;
    const sueldoKey = generatedExpenseKey(
      week.anio,
      week.numero_semana,
      conductorSemana.conductor.id,
      TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR
    );
    const bonoKey = generatedExpenseKey(
      week.anio,
      week.numero_semana,
      conductorSemana.conductor.id,
      TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR
    );
    const generatedSueldo = gastosGeneradosPorConductor.get(sueldoKey);
    const generatedBono = gastosGeneradosPorConductor.get(bonoKey);
    const sueldo = generatedSueldo?.monto ?? toMoney(conductorSemana.conductor.sueldo_semanal);
    const bono = generatedBono?.monto ?? calculateBonificacion(conductorSemana.total_fletes, config);

    if (generatedSueldo) processedGeneratedKeys.add(sueldoKey);
    if (generatedBono) processedGeneratedKeys.add(bonoKey);

    const amounts = {
      sueldos: sueldo,
      bonos: bono,
      retornos: conductorSemana.retorno_gastos,
      domingos: conductorSemana.domingo_gastos
    };
    const semanaGroup = getSemanaGroup(week);
    const transportistaGroup = getTransportistaGroup(conductorSemana.conductor);

    transportistaGroup.cantidad_viajes += conductorSemana.cantidad_viajes;
    addReporteUtilidadTotals(resumenTotales, amounts);
    addReporteUtilidadTotals(semanaGroup.totales, amounts);
    addReporteUtilidadTotals(transportistaGroup.totales, amounts);

    if (assignedVehicle) {
      addReporteUtilidadTotals(getVehiculoGroup(assignedVehicle).totales, amounts);
    }
  }

  for (const [key, { gasto, monto }] of gastosGeneradosPorConductor.entries()) {
    if (processedGeneratedKeys.has(key) || !gasto.conductor) continue;

    const semana = semanasMap.get(weekKey(gasto.anio, gasto.numero_semana));
    if (!semana) continue;

    const amounts =
      gasto.tipo === TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR
        ? { sueldos: monto }
        : { bonos: monto };
    const transportistaGroup = getTransportistaGroup(gasto.conductor);

    addReporteUtilidadTotals(resumenTotales, amounts);
    addReporteUtilidadTotals(getSemanaGroup(semana).totales, amounts);
    addReporteUtilidadTotals(getVehiculoGroup(gasto.vehiculo).totales, amounts);
    addReporteUtilidadTotals(transportistaGroup.totales, amounts);
  }

  finalizeReporteUtilidadTotales(resumenTotales);

  const vehiculosItems = [...vehiculos.values()]
    .map((item) => ({
      ...item,
      totales: finalizeReporteUtilidadTotales(item.totales)
    }))
    .sort((left, right) => left.vehiculo.placa.localeCompare(right.vehiculo.placa));
  const transportistasItems = [...transportistas.values()]
    .map((item) => ({
      ...item,
      totales: finalizeReporteUtilidadTotales(item.totales)
    }))
    .sort((left, right) => right.totales.pago_transportistas.comparedTo(left.totales.pago_transportistas));
  const clientesItems = [...clientes.values()]
    .map((item) => ({
      ...item,
      totales: finalizeReporteUtilidadTotales(item.totales)
    }))
    .sort((left, right) => right.totales.total_facturado.comparedTo(left.totales.total_facturado));
  const semanasItems = [...semanasResumen.values()]
    .map((item) => ({
      ...item,
      totales: finalizeReporteUtilidadTotales(item.totales)
    }))
    .sort((left, right) => left.fecha_inicio.getTime() - right.fecha_inicio.getTime());

  return {
    filtros: {
      anio: filters.anio,
      mes: filters.mes,
      vehiculo_id: filters.vehiculo_id ?? null
    },
    periodo: {
      anio: filters.anio,
      mes: filters.mes,
      mes_label: monthNames[filters.mes - 1] ?? `Mes ${filters.mes}`,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      semanas: semanas.map((semana) => ({
        anio: semana.anio,
        numero_semana: semana.numero_semana,
        fecha_inicio: semana.fecha_inicio,
        fecha_fin: semana.fecha_fin
      }))
    },
    resumen: {
      cantidad_viajes: viajes.length,
      cantidad_mantenimientos: mantenimientos.length,
      cantidad_vehiculos: vehiculosItems.length,
      cantidad_transportistas: transportistasItems.length,
      totales: resumenTotales
    },
    vehiculos: vehiculosItems,
    clientes: clientesItems,
    transportistas: transportistasItems,
    semanas: semanasItems
  };
};

export const buildReporteUtilidadExportTable = (
  reporte: Awaited<ReturnType<typeof getReporteUtilidad>>
): ReportExportTable => ({
  title: 'Reporte de utilidad',
  subtitle: `${reporte.periodo.mes_label} ${reporte.periodo.anio}`,
  filenameBase: `reporte-utilidad-${reporte.periodo.anio}-${String(reporte.periodo.mes).padStart(2, '0')}`,
  summary: [
    { label: 'Viajes', value: reporte.resumen.cantidad_viajes },
    { label: 'Vehiculos', value: reporte.resumen.cantidad_vehiculos },
    { label: 'Transportistas', value: reporte.resumen.cantidad_transportistas },
    { label: 'Precio fletes', value: reporte.resumen.totales.precio_fletes },
    { label: 'Total facturado', value: reporte.resumen.totales.total_facturado },
    { label: 'Utilidad viajes', value: reporte.resumen.totales.utilidad_viajes },
    { label: 'Mantenimientos', value: reporte.resumen.totales.mantenimientos },
    { label: 'Sueldos', value: reporte.resumen.totales.sueldos },
    { label: 'Bonos', value: reporte.resumen.totales.bonos },
    { label: 'Ganancia neta', value: reporte.resumen.totales.ganancia_neta }
  ],
  columns: [
    { key: 'semana', header: 'Semana', width: 12 },
    { key: 'fechas', header: 'Fechas', width: 24 },
    { key: 'viajes', header: 'Viajes', width: 10 },
    { key: 'mantenimientos_count', header: 'Mantenimientos', width: 16 },
    { key: 'precio_fletes', header: 'Precio fletes', width: 14 },
    { key: 'total_facturado', header: 'Total facturado', width: 16 },
    { key: 'utilidad_viajes', header: 'Utilidad viajes', width: 16 },
    { key: 'mantenimientos', header: 'Gasto mantenimiento', width: 18 },
    { key: 'sueldos', header: 'Sueldos', width: 12 },
    { key: 'bonos', header: 'Bonos', width: 12 },
    { key: 'ganancia_neta', header: 'Ganancia neta', width: 16 }
  ],
  rows: reporte.semanas.map((item) => ({
    semana: item.numero_semana,
    fechas: `${dateOnlyString(item.fecha_inicio)} - ${dateOnlyString(item.fecha_fin)}`,
    viajes: item.cantidad_viajes,
    mantenimientos_count: item.cantidad_mantenimientos,
    precio_fletes: item.totales.precio_fletes,
    total_facturado: item.totales.total_facturado,
    utilidad_viajes: item.totales.utilidad_viajes,
    mantenimientos: item.totales.mantenimientos,
    sueldos: item.totales.sueldos,
    bonos: item.totales.bonos,
    ganancia_neta: item.totales.ganancia_neta
  }))
});

const getMantenimientoKmAnticipacion = async (propietarioId: bigint) => {
  const configs = await prisma.configuracionOperativa.findMany({
    where: {
      clave: 'alerta_mantenimiento_km_anticipacion',
      OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
    }
  });
  const own = configs.find((item) => item.propietario_id === propietarioId);
  const global = configs.find((item) => item.propietario_id === null);
  const parsed = Number((own ?? global)?.valor);

  return Number.isFinite(parsed) && parsed >= 0
    ? Math.trunc(parsed)
    : CONFIG_DEFAULTS.alerta_mantenimiento_km_anticipacion;
};

const buildVehiculo = (vehiculo: MantenimientoReporte['vehiculo']) => ({
  id: vehiculo.id,
  placa: vehiculo.placa,
  marca: vehiculo.marca,
  modelo: vehiculo.modelo,
  color: vehiculo.color,
  kilometraje_actual: vehiculo.kilometraje_actual,
  categoria_peaje: vehiculo.categoria_peaje
    ? {
        id: vehiculo.categoria_peaje.id,
        nombre: vehiculo.categoria_peaje.nombre
      }
    : null,
  estado: prismaToApiEstadoVehiculo[vehiculo.estado]
});

const buildAlertInfo = (
  mantenimiento: MantenimientoReporte,
  today: Date,
  kmAnticipacion: number,
  diasAnticipacionFecha: number
) => {
  const kmRestantes =
    mantenimiento.proximo_mantenimiento_km === null
      ? null
      : mantenimiento.proximo_mantenimiento_km - mantenimiento.vehiculo.kilometraje_actual;
  const diasRestantes = mantenimiento.proximo_mantenimiento_fecha
    ? diffDays(today, mantenimiento.proximo_mantenimiento_fecha)
    : null;
  const vencidoPorKm = kmRestantes !== null && kmRestantes <= 0;
  const porVencerPorKm =
    kmRestantes !== null && kmRestantes > 0 && kmRestantes <= kmAnticipacion;
  const vencidoPorFecha = diasRestantes !== null && diasRestantes < 0;
  const porVencerPorFecha =
    diasRestantes !== null &&
    diasRestantes >= 0 &&
    diasRestantes <= diasAnticipacionFecha;

  const estadoAlerta =
    vencidoPorKm || vencidoPorFecha
      ? 'vencido'
      : porVencerPorKm || porVencerPorFecha
        ? 'por_vencer'
        : 'vigente';

  return {
    estado_alerta: estadoAlerta,
    km_restantes: kmRestantes,
    dias_restantes: diasRestantes,
    criterios_alerta: {
      por_km: {
        aplica: kmRestantes !== null,
        vencido: vencidoPorKm,
        por_vencer: porVencerPorKm,
        km_anticipacion: kmAnticipacion
      },
      por_fecha: {
        aplica: diasRestantes !== null,
        vencido: vencidoPorFecha,
        por_vencer: porVencerPorFecha,
        dias_anticipacion: diasAnticipacionFecha
      }
    }
  };
};

const formatMantenimiento = (
  mantenimiento: MantenimientoReporte,
  alertInfo: ReturnType<typeof buildAlertInfo>
) => ({
  id: mantenimiento.id,
  fecha_mantenimiento: mantenimiento.fecha_mantenimiento,
  vehiculo: buildVehiculo(mantenimiento.vehiculo),
  tipo_mantenimiento: {
    id: mantenimiento.tipo_mantenimiento.id,
    nombre: mantenimiento.tipo_mantenimiento.nombre,
    es_periodico: mantenimiento.tipo_mantenimiento.es_periodico,
    intervalo_km: mantenimiento.tipo_mantenimiento.intervalo_km,
    intervalo_dias: mantenimiento.tipo_mantenimiento.intervalo_dias
  },
  kilometraje_actual_vehiculo: mantenimiento.kilometraje_actual_vehiculo,
  descripcion: mantenimiento.descripcion,
  costo_mano_obra: mantenimiento.costo_mano_obra,
  costo_repuestos: mantenimiento.costo_repuestos,
  costo_total: mantenimiento.costo_total,
  proximo_mantenimiento_km: mantenimiento.proximo_mantenimiento_km,
  proximo_mantenimiento_fecha: mantenimiento.proximo_mantenimiento_fecha,
  estado: prismaToApiEstadoMantenimiento[mantenimiento.estado],
  ...alertInfo,
  repuestos: mantenimiento.repuestos
});

const buildWhere = (
  propietarioId: bigint,
  filters: ReturnType<typeof reporteMantenimientosFiltersSchema.parse>
) => {
  const where: Prisma.MantenimientoWhereInput = {
    propietario_id: propietarioId
  };

  if (filters.estado) {
    where.estado = apiToPrismaEstadoMantenimiento[filters.estado];
  } else {
    where.estado = { not: EstadoMantenimiento.CANCELADO };
  }

  if (filters.vehiculo_id) {
    where.vehiculo_id = parseBigIntId(filters.vehiculo_id, 'vehiculo_id');
  }

  if (filters.tipo_mantenimiento_id) {
    where.tipo_mantenimiento_id = parseBigIntId(
      filters.tipo_mantenimiento_id,
      'tipo_mantenimiento_id'
    );
  }

  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha_mantenimiento = {};

    if (filters.fecha_desde) {
      where.fecha_mantenimiento.gte = toDateOnly(filters.fecha_desde)!;
    }

    if (filters.fecha_hasta) {
      where.fecha_mantenimiento.lte = toDateOnly(filters.fecha_hasta)!;
    }
  }

  const and: Prisma.MantenimientoWhereInput[] = [];

  if (filters.placa) {
    and.push({
      vehiculo: {
        placa: {
          contains: filters.placa,
          mode: 'insensitive'
        }
      }
    });
  }

  const palabraClave = filters.palabra_clave ?? filters.search;
  if (palabraClave) {
    and.push({
      OR: [
        { descripcion: { contains: palabraClave, mode: 'insensitive' } },
        { vehiculo: { placa: { contains: palabraClave, mode: 'insensitive' } } },
        { tipo_mantenimiento: { nombre: { contains: palabraClave, mode: 'insensitive' } } },
        { repuestos: { some: { nombre_repuesto: { contains: palabraClave, mode: 'insensitive' } } } }
      ]
    });
  }

  if (and.length) {
    where.AND = and;
  }

  return where;
};

const filterLatestByVehicleAndType = (mantenimientos: MantenimientoReporte[]) => {
  const latest = new Map<string, MantenimientoReporte>();

  for (const mantenimiento of mantenimientos) {
    const key = `${mantenimiento.vehiculo_id}:${mantenimiento.tipo_mantenimiento_id}`;

    if (!latest.has(key)) {
      latest.set(key, mantenimiento);
    }
  }

  return [...latest.values()];
};

export const getReporteMantenimientos = async (propietarioIdInput: unknown, input: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const filters = reporteMantenimientosFiltersSchema.parse(input);
  const [kmAnticipacion, mantenimientos] = await Promise.all([
    getMantenimientoKmAnticipacion(propietarioId),
    prisma.mantenimiento.findMany({
      where: buildWhere(propietarioId, filters),
      include: mantenimientoInclude,
      orderBy: [{ fecha_mantenimiento: 'desc' }, { id: 'desc' }]
    })
  ]);
  const today = todayDateOnly();
  const source = filters.por_vencer
    ? filterLatestByVehicleAndType(mantenimientos)
    : mantenimientos;
  const items = source
    .map((mantenimiento) => ({
      mantenimiento,
      alertInfo: buildAlertInfo(
        mantenimiento,
        today,
        kmAnticipacion,
        filters.dias_anticipacion_fecha
      )
    }))
    .filter((item) => {
      if (!filters.por_vencer) return true;

      return item.alertInfo.estado_alerta === 'por_vencer' || item.alertInfo.estado_alerta === 'vencido';
    })
    .map((item) => formatMantenimiento(item.mantenimiento, item.alertInfo));

  const resumen = items.reduce(
    (totals, mantenimiento) => ({
      total: totals.total + 1,
      vencidos: totals.vencidos + (mantenimiento.estado_alerta === 'vencido' ? 1 : 0),
      por_vencer:
        totals.por_vencer + (mantenimiento.estado_alerta === 'por_vencer' ? 1 : 0),
      vigentes: totals.vigentes + (mantenimiento.estado_alerta === 'vigente' ? 1 : 0),
      costo_mano_obra: addMoney(totals.costo_mano_obra, mantenimiento.costo_mano_obra),
      costo_repuestos: addMoney(totals.costo_repuestos, mantenimiento.costo_repuestos),
      costo_total: addMoney(totals.costo_total, mantenimiento.costo_total)
    }),
    {
      total: 0,
      vencidos: 0,
      por_vencer: 0,
      vigentes: 0,
      costo_mano_obra: toMoney(0),
      costo_repuestos: toMoney(0),
      costo_total: toMoney(0)
    }
  );

  return {
    filtros: {
      fecha_desde: filters.fecha_desde ?? null,
      fecha_hasta: filters.fecha_hasta ?? null,
      placa: filters.placa ?? null,
      palabra_clave: filters.palabra_clave ?? filters.search ?? null,
      por_vencer: filters.por_vencer ?? false,
      vehiculo_id: filters.vehiculo_id ?? null,
      tipo_mantenimiento_id: filters.tipo_mantenimiento_id ?? null,
      estado: filters.estado ?? null
    },
    configuracion: {
      alerta_mantenimiento_km_anticipacion: kmAnticipacion,
      dias_anticipacion_fecha: filters.dias_anticipacion_fecha
    },
    resumen,
    items
  };
};

export const buildReporteMantenimientosExportTable = (
  reporte: Awaited<ReturnType<typeof getReporteMantenimientos>>
): ReportExportTable => ({
  title: 'Reporte de mantenimientos',
  subtitle: `Total: ${reporte.resumen.total} | Vencidos: ${reporte.resumen.vencidos} | Por vencer: ${reporte.resumen.por_vencer}`,
  filenameBase: 'reporte-mantenimientos',
  summary: [
    { label: 'Total registros', value: reporte.resumen.total },
    { label: 'Vencidos', value: reporte.resumen.vencidos },
    { label: 'Por vencer', value: reporte.resumen.por_vencer },
    { label: 'Vigentes', value: reporte.resumen.vigentes },
    { label: 'Costo mano obra', value: reporte.resumen.costo_mano_obra },
    { label: 'Costo repuestos', value: reporte.resumen.costo_repuestos },
    { label: 'Costo total', value: reporte.resumen.costo_total }
  ],
  columns: [
    { key: 'fecha', header: 'Fecha', width: 12 },
    { key: 'placa', header: 'Placa', width: 12 },
    { key: 'vehiculo', header: 'Vehiculo', width: 20 },
    { key: 'tipo_mantenimiento', header: 'Tipo', width: 20 },
    { key: 'descripcion', header: 'Descripcion', width: 28 },
    { key: 'estado', header: 'Estado', width: 14 },
    { key: 'alerta', header: 'Alerta', width: 14 },
    { key: 'km_actual', header: 'Km actual', width: 12 },
    { key: 'proximo_km', header: 'Prox. km', width: 12 },
    { key: 'km_restantes', header: 'Km restantes', width: 14 },
    { key: 'proxima_fecha', header: 'Prox. fecha', width: 14 },
    { key: 'dias_restantes', header: 'Dias restantes', width: 14 },
    { key: 'costo_mano_obra', header: 'Mano obra', width: 12 },
    { key: 'costo_repuestos', header: 'Repuestos', width: 12 },
    { key: 'costo_total', header: 'Total', width: 12 },
    { key: 'repuestos', header: 'Detalle repuestos', width: 32 }
  ],
  rows: reporte.items.map((item) => ({
    fecha: item.fecha_mantenimiento,
    placa: item.vehiculo.placa,
    vehiculo: `${item.vehiculo.marca} ${item.vehiculo.modelo ?? ''}`.trim(),
    tipo_mantenimiento: item.tipo_mantenimiento.nombre,
    descripcion: item.descripcion,
    estado: item.estado,
    alerta: item.estado_alerta,
    km_actual: item.vehiculo.kilometraje_actual,
    proximo_km: item.proximo_mantenimiento_km,
    km_restantes: item.km_restantes,
    proxima_fecha: item.proximo_mantenimiento_fecha,
    dias_restantes: item.dias_restantes,
    costo_mano_obra: item.costo_mano_obra,
    costo_repuestos: item.costo_repuestos,
    costo_total: item.costo_total,
    repuestos: item.repuestos
      .map(
        (repuesto) =>
          `${repuesto.nombre_repuesto} (${repuesto.cantidad} x ${repuesto.costo_unitario})`
      )
      .join('; ')
  }))
});
