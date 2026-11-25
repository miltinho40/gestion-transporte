import { formatDateOnly } from '../../core/date-only';
import type {
  ClienteOption,
  ProveedorOption,
  TarifaRutaOption,
  ViajeProveedorRow
} from './proveedor-transporte.models';

export const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const todayInputDate = () => toDateInputValue(new Date());

export const tomorrowInputDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateInputValue(date);
};

export const rutaLabel = (row: ViajeProveedorRow) => {
  const ruta = row.tarifa_ruta?.ruta;
  return ruta ? `${ruta.origen} - ${ruta.destino}` : '-';
};

export const clienteLabel = (cliente: ClienteOption) => {
  return `${cliente.nombre} - ${cliente.ruc_cedula}`;
};

export const proveedorLabel = (proveedor: ProveedorOption) => {
  return `${proveedor.nombre} - ${proveedor.ruc_cedula}`;
};

export const tarifaLabel = (tarifa: TarifaRutaOption) => {
  const capacidad = tarifa.capacidad ? ` | ${tarifa.capacidad}` : '';
  return `${tarifa.ruta.origen} - ${tarifa.ruta.destino} | ${tarifa.tipo_carga.nombre}${capacidad} | $ ${money(tarifa.precio)}`;
};

export const guiaPreview = (row: ViajeProveedorRow) => {
  const text = row.numeros_guia_remision.join(', ');
  return text.length > 20 ? `${text.slice(0, 20)}...` : text || '-';
};

export const weekNumber = (value: unknown) => {
  const date = new Date(`${dateInput(value)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '-';

  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
};

export const money = (value: unknown) => {
  return number(value).toFixed(2);
};

export const number = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const dateInput = (value: unknown) => {
  const text = String(value ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
};

export const findCatalogMatch = <T>(items: T[], value: string, label: (item: T) => string) => {
  const normalized = value.trim().toLowerCase();
  return items.find((item) => label(item).toLowerCase() === normalized) ?? null;
};

export const dateOnly = formatDateOnly;
export const providerFinancials = (
  price: unknown,
  clientCommission: unknown,
  providerPercentage: unknown
) => {
  const base = number(price);
  const billable = base - (base * number(clientCommission)) / 100;
  const payable = billable - (billable * number(providerPercentage)) / 100;
  return {
    valor_a_facturar: Number(billable.toFixed(2)),
    precio_pagar_proveedor: Number(payable.toFixed(2))
  };
};
