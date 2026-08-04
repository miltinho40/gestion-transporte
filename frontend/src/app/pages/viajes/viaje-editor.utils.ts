export const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const todayInputDate = () => toDateInputValue(new Date());

export const dateInputValue = (value?: string | null) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const dateOnlyParts = (value?: string | null) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? '').trim());
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
};

export const addDaysInputDate = (value: string, days: number) => {
  const parts = dateOnlyParts(value);
  if (!parts) return value;

  const date = new Date(parts.year, parts.month - 1, parts.day);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
};

export const isoWeekInfo = (value?: string | null) => {
  const parts = dateOnlyParts(value);
  if (!parts) {
    return { key: 'sin-fecha', label: 'Sin fecha', title: 'Sin fecha', week: null, year: null };
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);

  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return {
    key: `${weekYear}-${week}`,
    label: `Sem ${week}`,
    title: `Semana ${week} - ${weekYear}`,
    week,
    year: weekYear
  };
};

export const dateSortValue = (value?: string | null) => {
  const parts = dateOnlyParts(value);
  if (!parts) return Number.MAX_SAFE_INTEGER;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
};

export const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const searchText = (...values: unknown[]) =>
  values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .join(' ')
    .toLowerCase();

export const roundMoney = (value: number) => Number(value.toFixed(2));

export const splitGuiasRemision = (value: unknown) =>
  String(value ?? '')
    .split(/[\n,;-]+/)
    .map((item) => item.trim())
    .filter(Boolean);
