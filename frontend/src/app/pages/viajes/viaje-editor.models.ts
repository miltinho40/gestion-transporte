import type { PaginatedResponse } from '../../core/pagination';

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

export type ViajesListResponse = ViajeRow[] | PaginatedResponse<ViajeRow>;

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

export interface GastoViajeItem {
  id?: string;
  tipo_gasto_id: string;
  tipo_gasto_nombre: string;
  descripcion: string | null;
  monto: number;
  es_estimado: boolean;
}

export interface ViajeDisplayRow {
  row: ViajeRow;
  weekLabel: string;
  weekTitle: string;
  weekClass: string;
}

export interface ViajesListState {
  page: number;
  limit: number;
  search: string;
  cliente: string;
  vehiculo: string;
  cobrado: string;
  semana: string;
}
