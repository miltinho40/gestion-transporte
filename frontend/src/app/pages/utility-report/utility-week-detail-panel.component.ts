import { Component, HostListener, input, output, signal } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { formatDateOnly } from '../../core/date-only';

export interface UtilityTotals {
  precio_fletes: string | number;
  total_facturado: string | number;
  utilidad_viajes: string | number;
  mantenimientos: string | number;
  sueldos: string | number;
  bonos: string | number;
  ganancia_neta: string | number;
  retornos: string | number;
  domingos: string | number;
  pago_transportistas: string | number;
}

interface UtilityVehicleDetail {
  vehiculo: {
    id: string;
    placa: string;
    marca: string;
    modelo?: string | null;
  };
  cantidad_viajes: number;
  cantidad_mantenimientos: number;
  totales: UtilityTotals;
}

interface UtilityMaintenanceDetail {
  id: string;
  fecha_mantenimiento: string;
  vehiculo: {
    id: string;
    placa: string;
    marca: string;
    modelo?: string | null;
  };
  tipo_mantenimiento: {
    id: string;
    nombre: string;
  };
  descripcion?: string | null;
  kilometraje_actual_vehiculo: number;
  costo_total: string | number;
}

interface UtilityDriverDetail {
  conductor: {
    id: string;
    nombre: string;
    cedula: string;
  };
  vehiculo?: {
    id: string;
    placa: string;
    marca: string;
    modelo?: string | null;
  } | null;
  cantidad_viajes: number;
  totales: UtilityTotals;
}

export interface UtilityWeekDetail {
  anio: number;
  numero_semana: number;
  fecha_inicio: string;
  fecha_fin: string;
  label: string;
  cantidad_viajes: number;
  cantidad_mantenimientos: number;
  totales: UtilityTotals;
  vehiculos: UtilityVehicleDetail[];
  mantenimientos: UtilityMaintenanceDetail[];
  transportistas: UtilityDriverDetail[];
}

type DetailTab = 'vehiculos' | 'mantenimientos' | 'sueldos';

@Component({
  selector: 'app-utility-week-detail-panel',
  imports: [LucideX],
  templateUrl: './utility-week-detail-panel.component.html',
  styleUrls: [
    '../reports/viaje-detail-panel.component.scss',
    './utility-week-detail-panel.component.scss'
  ]
})
export class UtilityWeekDetailPanelComponent {
  readonly week = input.required<UtilityWeekDetail>();
  readonly closed = output<void>();
  readonly activeTab = signal<DetailTab>('vehiculos');

  @HostListener('document:keydown.escape')
  closeOnEscape() {
    this.closed.emit();
  }

  close() {
    this.closed.emit();
  }

  selectTab(tab: DetailTab) {
    this.activeTab.set(tab);
  }

  money(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
  }

  number(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  dateOnly(value: unknown) {
    return formatDateOnly(value);
  }

  egresosTotales() {
    const totals = this.week().totales;
    return this.number(totals.mantenimientos) + this.number(totals.sueldos) + this.number(totals.bonos);
  }

  sueldosYBonos(totals: UtilityTotals) {
    return this.number(totals.sueldos) + this.number(totals.bonos);
  }
}
