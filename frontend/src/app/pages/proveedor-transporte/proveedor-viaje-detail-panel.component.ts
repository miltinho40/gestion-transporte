import { Component, HostListener, computed, input, output } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { formatDateOnly } from '../../core/date-only';

export interface ProveedorViajeDetail {
  id: string;
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
  created_at: string;
  updated_at: string;
  cliente: {
    nombre: string;
    ruc_cedula: string;
    porcentaje_comision: string | number;
  };
  proveedor: {
    nombre: string;
    ruc_cedula: string;
    porcentaje_utilidad: string | number;
  };
  tarifa_ruta: {
    ruta: {
      origen: string;
      destino: string;
    };
  };
}

@Component({
  selector: 'app-proveedor-viaje-detail-panel',
  imports: [LucideX],
  templateUrl: './proveedor-viaje-detail-panel.component.html',
  styleUrl: '../reports/viaje-detail-panel.component.scss'
})
export class ProveedorViajeDetailPanelComponent {
  readonly viaje = input<ProveedorViajeDetail | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();

  readonly comisionCliente = computed(() => {
    const viaje = this.viaje();
    return viaje ? this.number(viaje.precio_viaje) - this.number(viaje.valor_a_facturar) : 0;
  });

  readonly utilidadIntermediario = computed(() => {
    const viaje = this.viaje();
    if (!viaje) return 0;

    return (
      this.number(viaje.valor_a_facturar) -
      this.number(viaje.precio_pagar_proveedor) -
      this.number(viaje.viaticos)
    );
  });

  @HostListener('document:keydown.escape')
  closeOnEscape() {
    this.closed.emit();
  }

  close() {
    this.closed.emit();
  }

  money(value: unknown) {
    const parsed = this.number(value);
    return parsed.toFixed(2);
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
