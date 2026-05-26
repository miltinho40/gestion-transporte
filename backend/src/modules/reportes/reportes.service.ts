import { EstadoMantenimiento, EstadoVehiculo, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { parseBigIntId } from '../../utils/ids.js';
import type { ReportExportTable } from '../../utils/report-export.js';
import { reporteMantenimientosFiltersSchema } from './reportes.schema.js';

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
