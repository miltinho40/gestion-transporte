import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/api.service';
import type { SupportPromptResult } from '../../shared/dialog.service';
import type { ProveedorViajeDetail } from './proveedor-viaje-detail-panel.component';
import type {
  ClienteOption,
  ProveedorOption,
  TarifaRutaOption,
  ProveedorListFilters,
  ProveedorTripInput,
  ProveedorSupportOperation,
  ViajeProveedorRow,
  ViajesProveedorListResponse
} from './proveedor-transporte.models';

@Injectable({ providedIn: 'root' })
export class ProveedorTransporteApiService {
  private readonly api = inject(ApiService);
  clients() {
    return this.api.get<ClienteOption[]>('/clientes', { activo: true, solo_propios: true });
  }
  providers() {
    return this.api.get<ProveedorOption[]>('/proveedores', { activo: true, solo_propios: true });
  }
  prices() {
    return this.api.get<TarifaRutaOption[]>('/tarifas-ruta', { activa: true, solo_propios: true });
  }
  list(filters: ProveedorListFilters) {
    return this.api.get<ViajesProveedorListResponse>('/viajes-proveedor', { ...filters });
  }
  trip(id: string) {
    return this.api.get<ViajeProveedorRow>(`/viajes-proveedor/${id}`);
  }
  detail(id: string) {
    return this.api.get<ProveedorViajeDetail>(`/viajes-proveedor/${id}`);
  }
  save(input: ProveedorTripInput, id?: string) {
    return id
      ? this.api.put<ViajeProveedorRow>(`/viajes-proveedor/${id}`, input)
      : this.api.post<ViajeProveedorRow>('/viajes-proveedor', input);
  }
  support(id: string, operation: ProveedorSupportOperation, support: SupportPromptResult) {
    return this.api.patch<ViajeProveedorRow>(`/viajes-proveedor/${id}/${operation}`, support);
  }
  revertCollection(id: string) {
    return this.api.patch<ViajeProveedorRow>(`/viajes-proveedor/${id}/cobro`, { cobrado: false });
  }
  guides(id: string, value: string) {
    return this.api.patch<ViajeProveedorRow>(`/viajes-proveedor/${id}/guias`, {
      numeros_guia_remision: value
    });
  }
  remove(id: string) {
    return this.api.delete<unknown>(`/viajes-proveedor/${id}`);
  }
}
