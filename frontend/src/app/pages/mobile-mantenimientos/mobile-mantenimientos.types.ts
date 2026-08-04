export type EstadoMantenimiento = 'programado' | 'realizado' | 'cancelado' | 'vencido';
export type MantenimientoCatalogField = 'vehiculo_id' | 'tipo_mantenimiento_id';

export interface SelectOption {
  value: string;
  label: string;
}

export interface VehiculoOption {
  id: string;
  placa: string;
  marca: string;
  modelo?: string | null;
  kilometraje_actual: string | number;
  estado: string;
}

export interface TipoMantenimientoOption {
  id: string;
  nombre: string;
  descripcion?: string | null;
  es_periodico: boolean;
  intervalo_km?: number | null;
  intervalo_dias?: number | null;
  activo: boolean;
}

export interface RepuestoItem {
  id?: string;
  nombre_repuesto: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
}

export interface MantenimientoRow {
  id: string;
  vehiculo_id: string;
  tipo_mantenimiento_id: string;
  fecha_mantenimiento: string;
  kilometraje_actual_vehiculo: string | number;
  descripcion?: string | null;
  costo_mano_obra: string | number;
  costo_repuestos: string | number;
  costo_total: string | number;
  proximo_mantenimiento_km?: string | number | null;
  proximo_mantenimiento_fecha?: string | null;
  estado: EstadoMantenimiento;
  vehiculo?: VehiculoOption | null;
  tipo_mantenimiento?: TipoMantenimientoOption | null;
  repuestos?: RepuestoItem[];
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

export const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const nullableNumberValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const roundMoney = (value: number) => Number(value.toFixed(2));

export const addDaysInputDate = (dateInput: string, days: number) => {
  if (!dateInput) return '';
  const date = new Date(`${dateInput}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
};

export const dateSortValue = (value?: string | null) => {
  const date = dateInputValue(value);
  if (!date) return Number.MAX_SAFE_INTEGER;
  return new Date(`${date}T00:00:00`).getTime();
};

export const estadoMantenimientoLabel = (estado: EstadoMantenimiento) => {
  const labels: Record<EstadoMantenimiento, string> = {
    programado: 'Programado',
    realizado: 'Realizado',
    cancelado: 'Cancelado',
    vencido: 'Vencido'
  };

  return labels[estado] ?? estado;
};
