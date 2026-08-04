export type EstadoViajeProveedor = 'programado' | 'en_curso' | 'completado' | 'cancelado';
export type ProveedorViajeCatalogField = 'cliente_id' | 'proveedor_id' | 'tarifa_ruta_id';

export interface SelectOption {
  value: string;
  label: string;
}

export interface ClienteOption {
  id: string;
  nombre: string;
  ruc_cedula: string;
  porcentaje_comision: string | number;
}

export interface ProveedorOption {
  id: string;
  nombre: string;
  ruc_cedula: string;
  porcentaje_utilidad: string | number;
}

export interface TarifaRutaOption {
  id: string;
  precio: string | number;
  capacidad?: string | null;
  ruta: {
    id: string;
    origen: string;
    destino: string;
  };
  tipo_carga: {
    nombre: string;
  };
}

export interface ViajeProveedorRow {
  id: string;
  cliente_id: string;
  proveedor_id: string;
  tarifa_ruta_id: string;
  cliente: ClienteOption;
  proveedor: ProveedorOption;
  tarifa_ruta: TarifaRutaOption;
  fecha_salida: string;
  fecha_llegada?: string | null;
  descripcion_carga?: string | null;
  numeros_guia_remision: string[];
  precio_viaje: string | number;
  valor_a_facturar: string | number;
  precio_pagar_proveedor: string | number;
  viaticos: string | number;
  utilidad: string | number;
  cobrado: boolean;
  fecha_cobro?: string | null;
  pagado_proveedor: boolean;
  fecha_pago_proveedor?: string | null;
  estado: EstadoViajeProveedor;
  observaciones?: string | null;
}

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

export const dateOnlyParts = (value?: string | null) => {
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

export const dateSortValue = (value?: string | null) => {
  const parts = dateOnlyParts(value);
  if (!parts) return Number.MAX_SAFE_INTEGER;

  return Date.UTC(parts.year, parts.month - 1, parts.day);
};

export const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const roundMoney = (value: number) => Number(value.toFixed(2));

export const splitGuiasRemision = (value: unknown) =>
  String(value ?? '')
    .split(/[\n,;-]+/)
    .map((item) => item.trim())
    .filter(Boolean);

export const isoWeekInfo = (value?: string | null) => {
  const parts = dateOnlyParts(value);
  if (!parts) return { label: 'Sin semana', week: null, year: null };

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);

  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return { label: `Sem ${week}`, week, year: weekYear };
};
