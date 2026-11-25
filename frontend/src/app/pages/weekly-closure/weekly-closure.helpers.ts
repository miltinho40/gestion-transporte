import { formatDateOnly } from '../../core/date-only';
import type {
  CierreSemanal,
  VehiculoOption,
  ViajeCierre,
  EstadoViaje,
  EstadoMantenimiento,
  AsistenteCierre,
  AsistenteCierreAlerta,
  ActividadSemanalItem,
} from './weekly-closure.models';

export const splitGuiasRemision = (values: string[]) =>
  values
    .flatMap((value) => String(value ?? '').split(/[\n,;-]+/))
    .map((item) => item.trim())
    .filter(Boolean);

export const guiasReferencia = (guias: string[]) => guias.join(', ').slice(0, 10);

export const todayInputDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : (value ?? '0');
}

export function moneyOrDash(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return `$ ${money(value)}`;
}

export function dateOnly(value: unknown) {
  return formatDateOnly(value);
}

export function vehiculoLabel(vehiculo: VehiculoOption | CierreSemanal['vehiculo']) {
  return `${vehiculo.placa} - ${vehiculo.marca}${vehiculo.modelo ? ` ${vehiculo.modelo}` : ''}`;
}

export function transportistaLabel(cierre: CierreSemanal) {
  const nombres = [
    ...new Set((cierre.conductores ?? []).map((item) => item.conductor.nombre).filter(Boolean)),
  ];
  return nombres.length ? nombres.join(', ') : '-';
}

export function totalSueldoSemanal(cierre: CierreSemanal) {
  return cierre.resumen.totales['sueldos_sugeridos'];
}

export function totalBonos(cierre: CierreSemanal) {
  return cierre.resumen.totales['bonificaciones_sugeridas'];
}

export function totalSueldoBonos(cierre: CierreSemanal) {
  return numberValue(totalSueldoSemanal(cierre)) + numberValue(totalBonos(cierre));
}

export function totalSemanaReporte(cierre: CierreSemanal) {
  return (
    numberValue(totalSueldoSemanal(cierre)) +
    numberValue(totalBonos(cierre)) +
    totalGastoRetornoRetornos(cierre) +
    totalGastoRetornoDomingos(cierre)
  );
}

export function totalPrecioViajes(cierre: CierreSemanal) {
  return (cierre.viajes ?? []).reduce((total, viaje) => total + numberValue(viaje.precio_flete), 0);
}

export function gananciaSemanal(cierre: CierreSemanal) {
  if (gastosYaGenerados(cierre)) {
    return numberValue(cierre.resumen.totales['resultado_operativo']);
  }

  return (
    numberValue(cierre.resumen.totales['utilidad']) -
    numberValue(cierre.resumen.totales['mantenimientos']) -
    numberValue(cierre.resumen.totales['gastos_semanales']) -
    totalSueldoBonos(cierre)
  );
}

export function cantidadRetornos(cierre: CierreSemanal) {
  return (cierre.viajes ?? []).filter((viaje) => viaje.retorno).length;
}

export function totalGastoRetornoRetornos(cierre: CierreSemanal) {
  return totalGastoRetornoViajes(cierre, (viaje) => viaje.retorno);
}

export function cantidadDomingos(cierre: CierreSemanal) {
  return (cierre.viajes ?? []).filter((viaje) => viajeEntregaDomingo(viaje)).length;
}

export function totalGastoRetornoDomingos(cierre: CierreSemanal) {
  return totalGastoRetornoViajes(cierre, (viaje) => viajeEntregaDomingo(viaje));
}

export function gastosYaGenerados(cierre: CierreSemanal | null) {
  return Number(cierre?.resumen.cantidad_gastos_generados ?? 0) > 0;
}

export function cierreRequiereRevision(cierre: CierreSemanal | null) {
  return Boolean(cierre?.revision_cierre?.requiere_revision);
}

export function dateSortValue(value: unknown) {
  const date = dateOnly(value);
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);

  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

export function isSunday(value: unknown) {
  const date = dateOnly(value);
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);

  return Number.isFinite(timestamp) && new Date(timestamp).getUTCDay() === 0;
}

export function viajeEntregaDomingo(viaje: ViajeCierre) {
  return isSunday(viaje.fecha_llegada || viaje.fecha_salida);
}

export function fechaSemanaViaje(viaje: ViajeCierre) {
  return viaje.fecha_llegada || viaje.fecha_salida;
}

export function todaySortValue() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export function totalGastoRetornoViajes(
  cierre: CierreSemanal,
  predicate: (viaje: ViajeCierre) => boolean,
) {
  return (cierre.viajes ?? [])
    .filter(predicate)
    .reduce((total, viaje) => total + numberValue(viaje.retorno_gastos_viaje), 0);
}

export function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isoWeek(date: Date) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function semanaFutura(cierre: CierreSemanal) {
  return dateSortValue(cierre.semana.fecha_inicio) > todaySortValue();
}

export function semanaTerminada(cierre: CierreSemanal | null) {
  if (!cierre) return false;
  return dateSortValue(cierre.semana.fecha_fin) < todaySortValue();
}

export function assistantRiskLabel(riesgo: AsistenteCierre['riesgo']) {
  const labels: Record<AsistenteCierre['riesgo'], string> = {
    bajo: 'Bajo',
    medio: 'Medio',
    alto: 'Alto',
  };

  return labels[riesgo] ?? riesgo;
}

export function assistantSeverityLabel(severidad: AsistenteCierreAlerta['severidad']) {
  const labels: Record<AsistenteCierreAlerta['severidad'], string> = {
    info: 'Info',
    advertencia: 'Advertencia',
    critica: 'Crítica',
  };

  return labels[severidad] ?? severidad;
}

export function estadoViajeLabel(estado: EstadoViaje) {
  const labels: Record<EstadoViaje, string> = {
    programado: 'Programado',
    en_curso: 'En curso',
    completado: 'Completado',
    cancelado: 'Cancelado',
  };

  return labels[estado] ?? estado;
}

export function estadoMantenimientoLabel(estado: EstadoMantenimiento) {
  const labels: Record<EstadoMantenimiento, string> = {
    programado: 'Programado',
    realizado: 'Realizado',
    cancelado: 'Cancelado',
    vencido: 'Vencido',
  };

  return labels[estado] ?? estado;
}

export function viajeCopyText(viaje: ViajeCierre, guiasRemision: string[]) {
  return `1 viaje a ${viaje.ruta.destino} g#${guiasRemision.join(', ') || '-'}`;
}

export function actividadSemanal(cierre: CierreSemanal): ActividadSemanalItem[] {
  const viajes = (cierre.viajes ?? []).map((viaje) => {
    const guiasRemision = splitGuiasRemision(viaje.numeros_guia_remision ?? []);
    const guias = guiasRemision.length ? `Guías: ${guiasReferencia(guiasRemision)}` : null;

    return {
      trackId: `viaje-${viaje.id}`,
      sourceId: viaje.id,
      sourceType: 'viaje' as const,
      fecha: dateOnly(fechaSemanaViaje(viaje)),
      tipo: viaje.retorno ? ('Retorno' as const) : ('Viaje' as const),
      titulo: `${viaje.ruta.origen} - ${viaje.ruta.destino}`,
      detalle: [viaje.cliente.nombre, viaje.conductor.nombre, guias].filter(Boolean).join(' | '),
      flete: viaje.precio_flete,
      fleteReal: viaje.precio_real_flete,
      viaticos: viaje.viaticos,
      resultado: viaje.utilidad,
      copyText: viajeCopyText(viaje, guiasRemision),
      cobrado: viaje.cobrado,
      estado: estadoViajeLabel(viaje.estado),
      estadoClass: 'badge-soft',
      rowClass: viaje.cobrado ? 'weekly-activity-row-cobrado' : '',
      sortTime: dateSortValue(fechaSemanaViaje(viaje)),
    };
  });

  const mantenimientos = (cierre.mantenimientos ?? []).map((mantenimiento) => ({
    trackId: `mantenimiento-${mantenimiento.id}`,
    sourceId: mantenimiento.id,
    sourceType: 'mantenimiento' as const,
    fecha: dateOnly(mantenimiento.fecha_mantenimiento),
    tipo: 'Mantenimiento' as const,
    titulo: mantenimiento.tipo_mantenimiento.nombre,
    detalle: mantenimiento.descripcion || vehiculoLabel(mantenimiento.vehiculo),
    flete: null,
    fleteReal: null,
    viaticos: null,
    resultado: mantenimiento.costo_total,
    copyText: null,
    cobrado: false,
    estado: estadoMantenimientoLabel(mantenimiento.estado),
    estadoClass: 'badge-soft-warning',
    rowClass: 'weekly-activity-row-mantenimiento',
    sortTime: dateSortValue(mantenimiento.fecha_mantenimiento),
  }));

  const sortByDate = (left: ActividadSemanalItem, right: ActividadSemanalItem) => {
    if (left.sortTime !== right.sortTime) return left.sortTime - right.sortTime;
    return left.titulo.localeCompare(right.titulo);
  };

  return [...viajes.sort(sortByDate), ...mantenimientos.sort(sortByDate)];
}
