import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/api.service';
import type { CierreSemanal, VehiculoOption } from './weekly-closure.models';

export type CierreFilters = {
  anio: number;
  numero_semana: number;
  vehiculo_id: string;
};

export interface CobroSemanalInput {
  cobrado: true;
  fecha_cobro: string;
  soporte_cobro: string | null;
  sin_factura_cobro: boolean;
}

@Injectable({ providedIn: 'root' })
export class WeeklyClosureApiService {
  private readonly api = inject(ApiService);

  listVehiculos() {
    return this.api.get<VehiculoOption[]>('/vehiculos', { solo_propios: true });
  }

  getCierre(filters: CierreFilters) {
    return this.api.get<CierreSemanal>('/cierres-semanales', filters);
  }

  generarGastos(filters: CierreFilters) {
    return this.api.post<{ cierre: CierreSemanal }>('/cierres-semanales/generar-gastos', filters);
  }

  marcarCobrado(id: string, input: CobroSemanalInput) {
    return this.api.patch(`/viajes/${id}/cobro`, input);
  }

  guardarGuias(id: string, guias: string) {
    return this.api.patch(`/viajes/${id}/guias`, { numeros_guia_remision: guias });
  }
}
