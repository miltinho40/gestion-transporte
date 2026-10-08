import { Component, HostListener, computed, input, output } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { formatDateOnly } from '../../core/date-only';

export interface ViajeDetailExpense {
  id: string;
  descripcion?: string | null;
  monto: string | number;
  fecha_gasto: string;
  es_estimado: boolean;
  tipo_gasto: {
    nombre: string;
  };
}

export interface ViajeDetail {
  id: string;
  fecha_salida: string;
  fecha_llegada?: string | null;
  descripcion_carga?: string | null;
  peso_carga_kg?: string | number | null;
  numeros_guia_remision: string[];
  precio_flete: string | number;
  porcentaje_comision_aplicado: string | number;
  valor_comision: string | number;
  precio_real_flete: string | number;
  costo_estimado_gastos: string | number;
  viaticos: string | number;
  costo_real_gastos?: string | number | null;
  cobrado: boolean;
  retorno: boolean;
  fecha_cobro?: string | null;
  soporte_cobro?: string | null;
  sin_factura_cobro?: boolean | null;
  estado: string;
  observaciones?: string | null;
  created_at: string;
  updated_at: string;
  cliente: {
    nombre: string;
    ruc_cedula: string;
  };
  vehiculo: {
    placa: string;
    marca: string;
    modelo?: string | null;
    capacidad?: string | null;
    toneladas?: string | number | null;
  };
  conductor: {
    nombre: string;
    cedula: string;
  };
  tarifa_ruta: {
    capacidad?: string | null;
    toneladas?: string | number | null;
    ruta: {
      origen: string;
      destino: string;
      distancia_km?: string | number | null;
    };
    tipo_carga: {
      nombre: string;
    };
  };
}

@Component({
  selector: 'app-viaje-detail-panel',
  imports: [LucideX],
  templateUrl: './viaje-detail-panel.component.html',
  styleUrl: './viaje-detail-panel.component.scss'
})
export class ViajeDetailPanelComponent {
  readonly viaje = input<ViajeDetail | null>(null);
  readonly gastos = input<ViajeDetailExpense[]>([]);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();

  readonly utilidad = computed(() => {
    const viaje = this.viaje();
    if (!viaje) return 0;

    return this.number(viaje.precio_real_flete) - this.number(viaje.costo_real_gastos);
  });

  readonly totalGastosAdicionales = computed(() =>
    this.gastos().reduce((total, gasto) => total + this.number(gasto.monto), 0)
  );

  @HostListener('document:keydown.escape')
  closeOnEscape() {
    this.closed.emit();
  }

  close() {
    this.closed.emit();
  }

  money(value: unknown) {
    return this.number(value).toFixed(2);
  }

  number(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  dateOnly(value: unknown) {
    return formatDateOnly(value);
  }

  dateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('es-EC', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  estadoLabel(value: string) {
    const labels: Record<string, string> = {
      programado: 'Programado',
      en_curso: 'En curso',
      completado: 'Completado',
      cancelado: 'Cancelado'
    };

    return labels[value] ?? value;
  }
}
