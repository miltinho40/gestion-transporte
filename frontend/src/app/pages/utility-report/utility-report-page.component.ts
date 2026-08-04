import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LucideDownload, LucideFileSpreadsheet, LucideRefreshCw } from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { formatDateOnly } from '../../core/date-only';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';

type ExportFormat = 'xlsx' | 'pdf';

interface VehiculoOption {
  id: string;
  placa: string;
  marca: string;
  modelo?: string | null;
}

interface UtilidadTotals {
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

interface UtilidadVehiculo {
  vehiculo: VehiculoOption;
  cantidad_viajes: number;
  cantidad_mantenimientos: number;
  totales: UtilidadTotals;
}

interface UtilidadTransportista {
  conductor: {
    id: string;
    nombre: string;
    cedula: string;
  };
  cantidad_viajes: number;
  totales: UtilidadTotals;
}

interface UtilidadCliente {
  cliente: {
    id: string;
    nombre: string;
    ruc_cedula: string;
  };
  cantidad_viajes: number;
  totales: UtilidadTotals;
}

interface UtilidadSemana {
  anio: number;
  numero_semana: number;
  fecha_inicio: string;
  fecha_fin: string;
  label: string;
  cantidad_viajes: number;
  cantidad_mantenimientos: number;
  totales: UtilidadTotals;
}

interface ReporteUtilidad {
  periodo: {
    anio: number;
    mes: number;
    mes_label: string;
    fecha_inicio: string;
    fecha_fin: string;
  };
  resumen: {
    cantidad_viajes: number;
    cantidad_mantenimientos: number;
    cantidad_vehiculos: number;
    cantidad_transportistas: number;
    totales: UtilidadTotals;
  };
  vehiculos: UtilidadVehiculo[];
  clientes: UtilidadCliente[];
  transportistas: UtilidadTransportista[];
  semanas: UtilidadSemana[];
}

const monthOptions = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
];

@Component({
  selector: 'app-utility-report-page',
  imports: [
    ReactiveFormsModule,
    LucideDownload,
    LucideFileSpreadsheet,
    LucideRefreshCw,
    AutoDismissAlertDirective
  ],
  templateUrl: './utility-report-page.component.html'
})
export class UtilityReportPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly downloading = signal(false);
  readonly loadingCatalogs = signal(false);
  readonly report = signal<ReporteUtilidad | null>(null);
  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly monthOptions = monthOptions;
  readonly clientColors = [
    '#40a36b',
    '#3b82f6',
    '#f59e0b',
    '#ef4444',
    '#14b8a6',
    '#8b5cf6',
    '#ec4899',
    '#64748b'
  ];

  readonly form = this.fb.nonNullable.group({
    anio: [new Date().getFullYear()],
    mes: [new Date().getMonth() + 1],
    vehiculo_id: ['']
  });

  constructor() {
    this.loadCatalogs();
    this.loadReport();
  }

  loadCatalogs() {
    this.loadingCatalogs.set(true);

    this.api.get<VehiculoOption[]>('/vehiculos').subscribe({
      next: (vehiculos) => {
        this.vehiculos.set(vehiculos);
        this.loadingCatalogs.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron cargar los vehículos.');
        this.loadingCatalogs.set(false);
      }
    });
  }

  loadReport() {
    this.loading.set(true);
    this.error.set(null);

    this.api.get<ReporteUtilidad>('/reportes/utilidad', this.reportParams()).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar el reporte de utilidad.');
        this.report.set(null);
        this.loading.set(false);
      }
    });
  }

  exportReport(format: ExportFormat) {
    this.error.set(null);
    this.downloading.set(true);

    this.api
      .download('/reportes/utilidad/export', {
        ...this.reportParams(),
        formato: format
      })
      .subscribe({
        next: (response) => {
          const filename = this.api.filenameFromDisposition(
            response.headers.get('content-disposition'),
            'reporte-utilidad'
          );
          this.api.saveBlob(response.body!, filename);
          this.downloading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudo exportar el reporte.');
          this.downloading.set(false);
        }
      });
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

  barWidth(value: unknown, max: number) {
    const parsed = Math.abs(this.number(value));
    if (!parsed || max <= 0) return '0%';

    return `${Math.max(5, Math.min(100, (parsed / max) * 100)).toFixed(2)}%`;
  }

  maxVehiculoValue(field: keyof UtilidadTotals) {
    const values = this.report()?.vehiculos.map((item) =>
      Math.abs(this.number(item.totales[field]))
    ) ?? [];

    return Math.max(0, ...values);
  }

  maxTransportistaPago() {
    const values = this.report()?.transportistas.map((item) =>
      this.number(item.totales.pago_transportistas)
    ) ?? [];

    return Math.max(0, ...values);
  }

  clientColor(index: number) {
    return this.clientColors[index % this.clientColors.length];
  }

  clientTotalFacturado(report: ReporteUtilidad) {
    return report.clientes.reduce(
      (total, item) => total + this.number(item.totales.total_facturado),
      0
    );
  }

  clientPercent(item: UtilidadCliente, report: ReporteUtilidad) {
    const total = this.clientTotalFacturado(report);
    if (total <= 0) return '0.0';

    return ((this.number(item.totales.total_facturado) / total) * 100).toFixed(1);
  }

  clientPieGradient(report: ReporteUtilidad) {
    const total = this.clientTotalFacturado(report);
    if (total <= 0) return '#eef2f6';

    let start = 0;
    const segments = report.clientes
      .map((item, index) => {
        const value = this.number(item.totales.total_facturado);
        if (value <= 0) return null;

        const end = start + (value / total) * 100;
        const segment = `${this.clientColor(index)} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
        start = end;

        return segment;
      })
      .filter((segment): segment is string => segment !== null);

    return segments.length ? `conic-gradient(${segments.join(', ')})` : '#eef2f6';
  }

  private reportParams() {
    const { anio, mes, vehiculo_id } = this.form.getRawValue();

    return {
      anio,
      mes,
      vehiculo_id
    };
  }
}
