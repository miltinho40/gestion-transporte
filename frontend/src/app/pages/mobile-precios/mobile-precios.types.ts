export type PrecioCatalogField = 'ruta_id' | 'tipo_carga_id';

export interface SelectOption {
  value: string;
  label: string;
}

export interface RutaOption {
  id: string;
  origen: string;
  destino: string;
  distancia_km: string | number;
  activa: boolean;
}

export interface TipoCargaOption {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface TarifaRutaRow {
  id: string;
  ruta_id: string;
  tipo_carga_id: string;
  ruta: RutaOption;
  tipo_carga: TipoCargaOption;
  capacidad?: string | null;
  toneladas?: string | number | null;
  precio: string | number;
  vigente_desde: string;
  vigente_hasta?: string | null;
  activa: boolean;
}

export const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const todayInputDate = () => toDateInputValue(new Date());

export const yearsFromTodayInputDate = (years: number) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return toDateInputValue(date);
};

export const dateInputValue = (value?: string | null) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

export const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
