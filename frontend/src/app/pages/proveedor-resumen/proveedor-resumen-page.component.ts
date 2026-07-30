import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LucideFileSpreadsheet } from '@lucide/angular';
import { debounceTime } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import {
  MultiSelectFilterComponent,
  MultiSelectFilterOption,
  MultiSelectFilterValue
} from '../../shared/multi-select-filter.component';

interface ProveedorOption {
  id: string;
  nombre: string;
  ruc_cedula: string;
}

interface ProveedorResumenTotals {
  precio_viaje: string | number;
  valor_a_facturar: string | number;
  precio_pagar_proveedor: string | number;
  viaticos: string | number;
  utilidad: string | number;
  pendientes_cobro: number;
  pendientes_pago: number;
}

interface ProveedorResumenCliente {
  cliente: {
    id: string;
    nombre: string;
    ruc_cedula: string;
  };
  cantidad_viajes: number;
  totales: ProveedorResumenTotals;
}

interface ProveedorResumenProveedor {
  proveedor: {
    id: string;
    nombre: string;
    ruc_cedula: string;
  };
  cantidad_viajes: number;
  totales: ProveedorResumenTotals;
}

interface ProveedorResumenReport {
  periodo: {
    anio: number;
    meses: Array<{ numero: number; label: string; fecha_inicio: string; fecha_fin: string }>;
  };
  resumen: {
    cantidad_viajes: number;
    cantidad_clientes: number;
    cantidad_proveedores: number;
    totales: ProveedorResumenTotals;
  };
  clientes: ProveedorResumenCliente[];
  proveedores: ProveedorResumenProveedor[];
}

const monthOptions: MultiSelectFilterOption[] = [
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
  selector: 'app-proveedor-resumen-page',
  imports: [
    ReactiveFormsModule,
    LucideFileSpreadsheet,
    AutoDismissAlertDirective,
    MultiSelectFilterComponent
  ],
  templateUrl: './proveedor-resumen-page.component.html',
  styleUrl: './proveedor-resumen-page.component.scss'
})
export class ProveedorResumenPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loadingCatalogs = signal(false);
  readonly report = signal<ProveedorResumenReport | null>(null);
  readonly proveedores = signal<ProveedorOption[]>([]);
  readonly selectedMonths = signal<MultiSelectFilterValue[]>([new Date().getMonth() + 1]);
  readonly selectedProviders = signal<MultiSelectFilterValue[]>([]);
  readonly monthOptions = monthOptions;
  readonly colors = ['#3b82f6', '#40a36b', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899', '#64748b'];
  private autoLoadTimer: ReturnType<typeof setTimeout> | null = null;

  readonly form = this.fb.nonNullable.group({
    anio: [new Date().getFullYear()]
  });

  readonly providerOptions = computed<MultiSelectFilterOption[]>(() =>
    this.proveedores().map((proveedor) => ({
      value: proveedor.id,
      label: `${proveedor.nombre} - ${proveedor.ruc_cedula}`,
      chipLabel: proveedor.nombre,
      searchText: `${proveedor.nombre} ${proveedor.ruc_cedula}`
    }))
  );

  constructor() {
    this.loadCatalogs();
    this.loadReport();
    this.form.valueChanges
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.scheduleLoad());
    this.destroyRef.onDestroy(() => {
      if (this.autoLoadTimer) clearTimeout(this.autoLoadTimer);
    });
  }

  loadCatalogs() {
    this.loadingCatalogs.set(true);
    this.api
      .get<ProveedorOption[]>('/proveedores', { activo: true, solo_propios: true })
      .subscribe({
        next: (proveedores) => {
          this.proveedores.set(proveedores);
          this.loadingCatalogs.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los proveedores.');
          this.loadingCatalogs.set(false);
        }
      });
  }

  loadReport() {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .get<ProveedorResumenReport>('/viajes-proveedor/resumen', this.reportParams())
      .subscribe({
        next: (report) => {
          this.report.set(report);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudo cargar el resumen de proveedores.');
          this.report.set(null);
          this.loading.set(false);
        }
      });
  }

  setMonths(values: MultiSelectFilterValue[]) {
    this.selectedMonths.set(values.map((value) => Number(value)).filter((value) => value >= 1 && value <= 12));
    this.scheduleLoad();
  }

  setProviders(values: MultiSelectFilterValue[]) {
    this.selectedProviders.set(values.map(String));
    this.scheduleLoad();
  }

  money(value: unknown) {
    return this.number(value).toFixed(2);
  }

  number(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  color(index: number) {
    return this.colors[index % this.colors.length];
  }

  clienteTotal(report: ProveedorResumenReport) {
    return report.clientes.reduce((total, item) => total + this.number(item.totales.valor_a_facturar), 0);
  }

  proveedorTotal(report: ProveedorResumenReport) {
    return report.proveedores.reduce((total, item) => total + this.number(item.totales.precio_pagar_proveedor), 0);
  }

  clientePercent(item: ProveedorResumenCliente, report: ProveedorResumenReport) {
    return this.percent(this.number(item.totales.valor_a_facturar), this.clienteTotal(report));
  }

  proveedorPercent(item: ProveedorResumenProveedor, report: ProveedorResumenReport) {
    return this.percent(this.number(item.totales.precio_pagar_proveedor), this.proveedorTotal(report));
  }

  clientePieGradient(report: ProveedorResumenReport) {
    return this.pieGradient(report.clientes.map((item) => this.number(item.totales.valor_a_facturar)));
  }

  proveedorPieGradient(report: ProveedorResumenReport) {
    return this.pieGradient(report.proveedores.map((item) => this.number(item.totales.precio_pagar_proveedor)));
  }

  periodoLabel(report: ProveedorResumenReport) {
    return report.periodo.meses.map((month) => month.label).join(', ') + ` ${report.periodo.anio}`;
  }

  private percent(value: number, total: number) {
    if (total <= 0) return '0.0';
    return ((value / total) * 100).toFixed(1);
  }

  private pieGradient(values: number[]) {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return '#eef2f6';

    let start = 0;
    const segments = values
      .map((value, index) => {
        if (value <= 0) return null;
        const end = start + (value / total) * 100;
        const segment = `${this.color(index)} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
        start = end;
        return segment;
      })
      .filter((segment): segment is string => segment !== null);

    return segments.length ? `conic-gradient(${segments.join(', ')})` : '#eef2f6';
  }

  private scheduleLoad() {
    if (this.autoLoadTimer) clearTimeout(this.autoLoadTimer);
    this.autoLoadTimer = setTimeout(() => this.loadReport(), 350);
  }

  private reportParams() {
    const { anio } = this.form.getRawValue();

    return {
      anio,
      meses: this.selectedMonths().length
        ? this.selectedMonths().join(',')
        : monthOptions.map((month) => month.value).join(','),
      proveedor_ids: this.selectedProviders().join(',')
    };
  }
}
