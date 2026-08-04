export type EstadoViaje = 'programado' | 'en_curso' | 'completado' | 'cancelado';
export type ViajeCatalogField =
  | 'cliente_id'
  | 'vehiculo_id'
  | 'conductor_id'
  | 'tarifa_ruta_id'
  | 'tipo_gasto_id';

export interface SelectOption {
  value: string;
  label: string;
}

export interface BasicOption {
  id: string;
  nombre: string;
  activo?: boolean;
}

export interface ClienteOption extends BasicOption {
  ruc_cedula: string;
  porcentaje_comision: string | number;
}

export interface VehiculoOption {
  id: string;
  placa: string;
  marca: string;
  modelo?: string | null;
}

export interface ConductorOption extends BasicOption {
  cedula: string;
}

export interface TarifaRutaOption {
  id: string;
  precio: string | number;
  capacidad?: string | null;
  toneladas?: string | number | null;
  ruta: {
    id: string;
    origen: string;
    destino: string;
    distancia_km: string | number;
  };
  tipo_carga: {
    nombre: string;
  };
}

export interface TipoGastoOption extends BasicOption {}

export interface GastoViajeItem {
  id?: string;
  tipo_gasto_id: string;
  tipo_gasto_nombre: string;
  descripcion: string | null;
  monto: number;
  es_estimado: boolean;
}

export interface ViajeRow {
  id: string;
  cliente_id: string;
  vehiculo_id: string;
  conductor_id: string;
  tarifa_ruta_id: string;
  cliente?: ClienteOption;
  vehiculo?: VehiculoOption;
  conductor?: ConductorOption;
  tarifa_ruta?: TarifaRutaOption;
  fecha_salida: string;
  fecha_llegada?: string | null;
  descripcion_carga?: string | null;
  peso_carga_kg?: string | number | null;
  numeros_guia_remision: string[];
  precio_flete: string | number;
  porcentaje_comision_aplicado: string | number;
  valor_comision: string | number;
  precio_real_flete: string | number;
  galones_diesel: string | number;
  costo_diesel: string | number;
  costo_peajes: string | number;
  costo_estimado_gastos: string | number;
  viaticos?: string | number | null;
  costo_real_gastos?: string | number | null;
  cobrado: boolean;
  retorno: boolean;
  fecha_cobro?: string | null;
  soporte_cobro?: string | null;
  sin_factura_cobro?: boolean;
  estado: EstadoViaje;
  observaciones?: string | null;
}

export interface CalculoViaje {
  distancia_km: string | number;
  precio_flete: string | number;
  porcentaje_comision: string | number;
  valor_comision: string | number;
  precio_real_flete: string | number;
  precio_galon_diesel: string | number;
  galones_diesel: string | number;
  costo_diesel: string | number;
  costo_peajes: string | number;
  costo_estimado_gastos: string | number;
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

export const estadoLabel = (estado: EstadoViaje) => {
  const labels: Record<EstadoViaje, string> = {
    programado: 'Programado',
    en_curso: 'En curso',
    completado: 'Completado',
    cancelado: 'Cancelado'
  };

  return labels[estado] ?? estado;
};

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
