import { Prisma } from '@prisma/client';
import { getIsoWeekRange } from '../cierres-semanales/cierres-semanales.service.js';

const monthNames = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
] as const;

export const dateOnly = (value: Date | null | undefined) =>
  value?.toISOString().slice(0, 10) ?? '-';

export const today = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return new Date(`${value.year}-${value.month}-${value.day}T00:00:00.000Z`);
};

const startOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

export const parseWeek = (message: string) => {
  const match = message.match(/(?:semana|sem)\s*#?\s*(\d{1,2})/i);
  const week = Number(match?.[1]);
  return Number.isInteger(week) && week >= 1 && week <= 53 ? week : null;
};

export const parseYear = (message: string) => {
  const match = message.match(/\b(20\d{2})\b/);
  const year = Number(match?.[1]);
  return Number.isInteger(year) ? year : today().getUTCFullYear();
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const parseRelativeDate = (normalized: string) => {
  const base = today();
  if (normalized.includes('pasado manana') || normalized.includes('pasado maniana')) {
    return addDays(base, 2);
  }
  if (normalized.includes('manana') || normalized.includes('maniana')) {
    return addDays(base, 1);
  }
  if (normalized.includes('ayer')) {
    return addDays(base, -1);
  }
  return base;
};

export const parseStructuredDate = (value: string | undefined, fallback: Date) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const parseMonth = (normalized: string) => {
  const index = monthNames.findIndex((name) => normalized.includes(name));
  if (index >= 0) return index;

  if (normalized.includes('mes pasado')) {
    const current = today();
    return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)).getUTCMonth();
  }

  return today().getUTCMonth();
};

export const dateRangeFromMessage = (message: string, normalized: string) => {
  const week = parseWeek(message);
  const year = parseYear(message);

  if (week) {
    const { fechaInicio, fechaFin } = getIsoWeekRange(year, week);
    return {
      label: `semana ${week} de ${year}`,
      fechaInicio,
      fechaFin
    };
  }

  const month = parseMonth(normalized);
  const date = new Date(Date.UTC(year, month, 1));
  return {
    label: `${monthNames[month]} de ${year}`,
    fechaInicio: startOfMonth(date),
    fechaFin: endOfMonth(date)
  };
};

export const viajeSemanaWhere = (
  fechaInicio: Date,
  fechaFin: Date
): Prisma.ViajeWhereInput => ({
  OR: [
    { fecha_llegada: { gte: fechaInicio, lte: fechaFin } },
    { fecha_llegada: null, fecha_salida: { gte: fechaInicio, lte: fechaFin } }
  ]
});

export const viajeProveedorSemanaWhere = (
  fechaInicio: Date,
  fechaFin: Date
): Prisma.ViajeProveedorWhereInput => ({
  OR: [
    { fecha_llegada: { gte: fechaInicio, lte: fechaFin } },
    { fecha_llegada: null, fecha_salida: { gte: fechaInicio, lte: fechaFin } }
  ]
});

export const ownerWhere = (propietarioId: bigint | null) =>
  propietarioId ? { propietario_id: propietarioId } : {};
