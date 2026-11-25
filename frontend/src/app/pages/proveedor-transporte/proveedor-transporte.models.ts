import type { PaginatedResponse } from '../../core/pagination';
import type { FormControl, FormGroup } from '@angular/forms';

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
  ruta: {
    origen: string;
    destino: string;
  };
  tipo_carga: {
    nombre: string;
  };
  capacidad?: string | null;
}

export interface ViajeProveedorRow {
  facturar_a_id?: string | null;
  id: string;
  cliente: ClienteOption;
  proveedor: ProveedorOption;
  tarifa_ruta: TarifaRutaOption;
  cliente_id: string;
  proveedor_id: string;
  tarifa_ruta_id: string;
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
  soporte_cobro?: string | null;
  sin_factura_cobro: boolean;
  pagado_proveedor: boolean;
  fecha_pago_proveedor?: string | null;
  soporte_pago_proveedor?: string | null;
  proveedor_sin_factura: boolean;
  estado: string;
  observaciones?: string | null;
}

export type ViajesProveedorListResponse =
  | ViajeProveedorRow[]
  | PaginatedResponse<ViajeProveedorRow>;
export type ProveedorEditorRequest = {
  mode: 'create' | 'edit' | 'duplicate';
  row?: ViajeProveedorRow;
  prefill?: Record<string, string | null>;
};
export interface ProveedorListFilters {
  search?: string;
  cobrado?: string;
  pagado_proveedor?: string;
  mostrar_finalizados?: boolean;
  cliente_ids?: string;
  proveedor_ids?: string;
  numero_semana?: string;
  anio_semana?: number | string;
  page?: number;
  limit?: number;
}
export interface ProveedorTripInput {
  cliente_id: string;
  facturar_a_id: string | null;
  proveedor_id: string;
  tarifa_ruta_id: string;
  fecha_salida: string;
  fecha_llegada: string | null;
  descripcion_carga: string | null;
  numeros_guia_remision: string | string[];
  precio_viaje: number;
  precio_pagar_proveedor: number;
  viaticos: number;
  pagado_proveedor: boolean;
  fecha_pago_proveedor: string | null;
  observaciones: string | null;
}
export type ProveedorSupportOperation = 'cobro' | 'pago';
export type ProveedorFilterForm = FormGroup<{
  search: FormControl<string>;
  cobrado: FormControl<string>;
  pagado_proveedor: FormControl<string>;
  mostrar_finalizados: FormControl<boolean>;
  numero_semana: FormControl<string>;
  anio_semana: FormControl<number>;
}>;
export type ProveedorRowAction = {
  type: 'detail' | 'duplicate' | 'revert-collection' | 'guides' | 'edit' | 'delete' | 'save-guides';
  row: ViajeProveedorRow;
};
export type ProveedorBulkAction = 'reload' | 'collect' | 'pay' | 'copy';
