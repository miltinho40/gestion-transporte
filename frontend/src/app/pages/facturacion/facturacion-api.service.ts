import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/api.service';
import type { ViajeDetail, ViajeDetailExpense } from '../reports/viaje-detail-panel.component';
import type { ProveedorViajeDetail } from '../proveedor-transporte/proveedor-viaje-detail-panel.component';
import type {
  BillingPayload,
  Cliente,
  Config,
  ConfirmedAmounts,
  Draft,
  Invoice,
  ListResult,
  PaymentInput,
  Preview,
  Trip,
  TripListFilters,
  TripSnapshot,
  Vehicle
} from './facturacion.models';

@Injectable({ providedIn: 'root' })
export class FacturacionApiService {
  private readonly api = inject(ApiService);
  configuration() {
    return this.api.get<Cliente[]>('/facturacion/configuracion');
  }
  vehicles() {
    return this.api.get<Vehicle[]>('/vehiculos', { solo_propios: true });
  }
  trips(filters: TripListFilters) {
    return this.api.get<ListResult<Trip>>('/facturacion/viajes', { ...filters });
  }
  invoices(page: number) {
    return this.api.get<ListResult<Invoice>>('/facturacion', { page });
  }
  invoice(id: string) {
    return this.api.get<Invoice>(`/facturacion/${id}`);
  }
  drafts(recipient: string) {
    return this.api.get<Draft[]>('/facturacion/borradores', { destinatario_id: recipient });
  }
  preview(payload: BillingPayload) {
    return this.api.post<Preview>('/facturacion/previsualizar', payload);
  }
  saveDraft(payload: BillingPayload, id: string, version: number) {
    return id
      ? this.api.put<Invoice>(`/facturacion/${id}/borrador`, { ...payload, version })
      : this.api.post<Invoice>('/facturacion/borradores', payload);
  }
  closeInvoice(id: string, version: number, amounts: ConfirmedAmounts) {
    return this.api.post<Invoice>(`/facturacion/${id}/cerrar`, { version, ...amounts });
  }
  undoInvoice(id: string, version: number) {
    return this.api.post<{ viajes_liberados: number }>(`/facturacion/${id}/deshacer`, { version });
  }
  payment(id: string, input: PaymentInput) {
    return this.api.post<unknown>(`/facturacion/${id}/abonos`, input);
  }
  saveConfiguration(client: Cliente) {
    return this.api.put<Config>('/facturacion/configuracion', {
      cliente_id: client.id,
      porcentaje_comision: Number(client.porcentaje_comision),
      destinatario_id: client.configuracion_facturacion.destinatario_id || null,
      ir_cliente: client.configuracion_facturacion.ir_cliente,
      ir_empresa: client.configuracion_facturacion.ir_empresa,
      modalidad_comision: client.configuracion_facturacion.modalidad_comision
    });
  }
  tripSnapshot(trip: Trip) {
    return this.api.get<TripSnapshot>(
      `/${trip.tipo === 'propio' ? 'viajes' : 'viajes-proveedor'}/${trip.id}`
    );
  }
  ownTrip(id: string) {
    return this.api.get<ViajeDetail>(`/viajes/${id}`);
  }
  tripExpenses(id: string) {
    return this.api.get<ViajeDetailExpense[]>(`/viajes/${id}/gastos`);
  }
  providerTrip(id: string) {
    return this.api.get<ProveedorViajeDetail>(`/viajes-proveedor/${id}`);
  }
}
