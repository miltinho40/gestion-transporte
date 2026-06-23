import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideCheck, LucideCopy, LucideDownload, LucideFileSpreadsheet, LucidePencil, LucidePlus } from '@lucide/angular';
import { debounceTime, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { formatDateOnly } from '../../core/date-only';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { DialogService } from '../../shared/dialog.service';
import {
  MultiSelectFilterComponent,
  type MultiSelectFilterValue
} from '../../shared/multi-select-filter.component';

type ExportFormat = 'xlsx' | 'pdf';

interface VehiculoOption {
  id: string;
  placa: string;
  marca: string;
  modelo?: string | null;
}

interface ClienteOption {
  id: string;
  nombre: string;
  ruc_cedula: string;
}

interface ReporteViajes {
  resumen: {
    cantidad_viajes: number;
    cantidad_mantenimientos: number;
    cantidad_vehiculos: number;
    cantidad_clientes: number;
    totales: {
      precio_viaje: string | number;
      valor_facturar: string | number;
      utilidad_viajes: string | number;
      mantenimientos: string | number;
      utilidad: string | number;
    };
  };
  semanas: {
    anio: number;
    numero_semana: number;
    fecha_inicio: string;
    fecha_fin: string;
    mes: number;
    mes_label: string;
  }[];
  meses: {
    mes: number;
    mes_label: string;
    cantidad_viajes: number;
    cantidad_mantenimientos: number;
    totales: {
      precio_viaje: string | number;
      valor_facturar: string | number;
      utilidad_viajes: string | number;
      mantenimientos: string | number;
      utilidad: string | number;
    };
  }[];
  items: ReporteViajeItem[];
}

interface ReporteViajeItem {
  id: string;
  fecha: string;
  mes_label: string;
  numero_semana: number;
  semana_label: string;
  cliente: ClienteOption;
  vehiculo: VehiculoOption;
  conductor: { id: string; nombre: string; cedula: string };
  ruta: { origen: string; destino: string };
  numeros_guia_remision: string[];
  precio_viaje: string | number;
  valor_facturar: string | number;
  viaticos: string | number;
  utilidad: string | number;
  cobrado: boolean;
  estado: string;
}

const weekOptions = Array.from({ length: 53 }, (_, index) => index + 1);

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const todayInputDate = () => toDateInputValue(new Date());

@Component({
  selector: 'app-reports-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    LucideCheck,
    LucideCopy,
    LucideDownload,
    LucideFileSpreadsheet,
    LucidePencil,
    LucidePlus,
    AutoDismissAlertDirective,
    MultiSelectFilterComponent
  ],
  templateUrl: './reports-page.component.html'
})
export class ReportsPageComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(DialogService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly downloading = signal(false);
  readonly loadingTravelReport = signal(false);
  readonly loadingCatalogs = signal(false);
  readonly travelReport = signal<ReporteViajes | null>(null);
  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly clientes = signal<ClienteOption[]>([]);
  readonly selectedWeeks = signal<number[]>([]);
  readonly selectedVehicleIds = signal<string[]>([]);
  readonly selectedClientIds = signal<string[]>([]);
  readonly selectedTripIds = signal<string[]>([]);
  readonly guideEditTripId = signal<string | null>(null);
  readonly guideInput = signal('');
  readonly weekOptions = weekOptions;
  private autoLoadTimer: ReturnType<typeof setTimeout> | null = null;

  readonly travelForm = this.fb.nonNullable.group({
    anio: [new Date().getFullYear()],
    cobrado: ['']
  });

  readonly summaryRows = computed(() => {
    const rows = this.travelReport()?.items ?? [];
    const ids = new Set(this.selectedTripIds());

    return ids.size ? rows.filter((row) => ids.has(row.id)) : rows;
  });

  readonly summary = computed(() => {
    const rows = this.summaryRows();
    const vehiculos = new Set(rows.map((row) => row.vehiculo.id));
    const clientes = new Set(rows.map((row) => row.cliente.id));
    const valorFacturar = rows.reduce((total, row) => total + this.number(row.valor_facturar), 0);
    const viaticos = rows.reduce((total, row) => total + this.number(row.viaticos), 0);

    return {
      viajes: rows.length,
      vehiculos: vehiculos.size,
      clientes: clientes.size,
      precio_viaje: rows.reduce((total, row) => total + this.number(row.precio_viaje), 0),
      valor_facturar: valorFacturar,
      viaticos,
      utilidad_viajes: valorFacturar - viaticos
    };
  });
  readonly vehiculoFilterOptions = computed(() =>
    this.vehiculos().map((vehiculo) => ({
      value: vehiculo.id,
      label: `${vehiculo.placa} - ${vehiculo.marca}`,
      chipLabel: vehiculo.placa,
      searchText: [vehiculo.placa, vehiculo.marca, vehiculo.modelo ?? ''].join(' ')
    }))
  );
  readonly weekFilterOptions = computed(() =>
    this.weekOptions.map((week) => ({
      value: week,
      label: `Semana ${week}`,
      chipLabel: `Sem ${week}`,
      searchText: `semana ${week} ${week}`
    }))
  );
  readonly clienteFilterOptions = computed(() =>
    this.clientes().map((cliente) => ({
      value: cliente.id,
      label: `${cliente.nombre} - ${cliente.ruc_cedula}`,
      chipLabel: cliente.nombre,
      searchText: `${cliente.nombre} ${cliente.ruc_cedula}`
    }))
  );

  constructor() {
    this.loadCatalogs();
    this.loadTravelReport();
    this.travelForm.valueChanges
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.scheduleLoadTravelReport());
    this.destroyRef.onDestroy(() => {
      if (this.autoLoadTimer) {
        clearTimeout(this.autoLoadTimer);
      }
    });
  }

  loadCatalogs() {
    this.loadingCatalogs.set(true);

    forkJoin({
      vehiculos: this.api.get<VehiculoOption[]>('/vehiculos'),
      clientes: this.api.get<ClienteOption[]>('/clientes')
    }).subscribe({
      next: ({ vehiculos, clientes }) => {
        this.vehiculos.set(vehiculos);
        this.clientes.set(clientes);
        this.loadingCatalogs.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron cargar los catálogos.');
        this.loadingCatalogs.set(false);
      }
    });
  }

  loadTravelReport() {
    const params = this.travelReportParams();

    this.loadingTravelReport.set(true);
    this.error.set(null);
    this.message.set(null);

    this.api.get<ReporteViajes>('/reportes/viajes', params).subscribe({
      next: (report) => {
        this.travelReport.set(report);
        this.selectedTripIds.set([]);
        this.loadingTravelReport.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar el reporte de viajes.');
        this.travelReport.set(null);
        this.loadingTravelReport.set(false);
      }
    });
  }

  exportTravel(format: ExportFormat) {
    const params = this.travelReportParams();

    this.download('/reportes/viajes/export', {
      ...params,
      formato: format
    });
  }

  setSelectedWeeks(values: MultiSelectFilterValue[]) {
    const weeks = values
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 53);

    this.selectedWeeks.set([...new Set(weeks)].sort((left, right) => left - right));
    this.scheduleLoadTravelReport();
  }

  setSelectedVehicles(values: MultiSelectFilterValue[]) {
    this.selectedVehicleIds.set(values.map((value) => String(value)));
    this.scheduleLoadTravelReport();
  }

  setSelectedClients(values: MultiSelectFilterValue[]) {
    this.selectedClientIds.set(values.map((value) => String(value)));
    this.scheduleLoadTravelReport();
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

  estadoLabel(estado: string) {
    const labels: Record<string, string> = {
      programado: 'Programado',
      en_curso: 'En curso',
      completado: 'Completado',
      cancelado: 'Cancelado'
    };

    return labels[estado] ?? estado;
  }

  guiaPreview(row: ReporteViajeItem) {
    const text = row.numeros_guia_remision.join(', ');
    return text.length > 20 ? `${text.slice(0, 20)}...` : text || '-';
  }

  isWeekGreen(row: ReporteViajeItem) {
    return row.numero_semana % 2 === 0;
  }

  isSelected(row: ReporteViajeItem) {
    return this.selectedTripIds().includes(row.id);
  }

  selectedCount() {
    return this.selectedTripIds().length;
  }

  hasSelected() {
    return this.selectedTripIds().length > 0;
  }

  allVisibleSelected() {
    const rows = this.travelReport()?.items ?? [];
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  toggleTripSelection(row: ReporteViajeItem, checked: boolean) {
    this.selectedTripIds.update((current) => {
      const ids = new Set(current);
      if (checked) {
        ids.add(row.id);
      } else {
        ids.delete(row.id);
      }

      return [...ids];
    });
  }

  toggleAllVisible(checked: boolean) {
    const ids = (this.travelReport()?.items ?? []).map((row) => row.id);
    this.selectedTripIds.set(checked ? ids : []);
  }

  selectedRows() {
    const ids = new Set(this.selectedTripIds());
    return (this.travelReport()?.items ?? []).filter((row) => ids.has(row.id));
  }

  async copySelectedLegend() {
    const rows = this.selectedRows();
    if (!rows.length) {
      this.message.set('Selecciona al menos un viaje.');
      return;
    }

    const text = rows.map((row) => this.tripLegend(row)).join('\n');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        this.copyTextFallback(text);
      }

      this.message.set('Leyenda copiada al portapapeles.');
    } catch {
      this.copyTextFallback(text);
      this.message.set('Leyenda copiada al portapapeles.');
    }
  }

  async markSelectedAsPaid() {
    const rows = this.selectedRows().filter((row) => !row.cobrado);
    if (!rows.length) {
      this.message.set('Los viajes seleccionados ya están cobrados.');
      return;
    }

    const confirmed = await this.dialog.confirm({
      title: 'Marcar viajes como cobrados',
      text: `Se marcarán ${rows.length} ${rows.length === 1 ? 'viaje' : 'viajes'} como cobrados con la fecha de hoy.`,
      confirmText: 'Sí, marcar cobrados'
    });

    if (!confirmed) return;

    this.loadingTravelReport.set(true);
    this.error.set(null);
    this.message.set(null);

    forkJoin(
      rows.map((row) =>
        this.api.patch(`/viajes/${row.id}/cobro`, {
          cobrado: true,
          fecha_cobro: todayInputDate()
        })
      )
    ).subscribe({
      next: () => {
        this.message.set(
          `${rows.length} ${rows.length === 1 ? 'viaje marcado' : 'viajes marcados'} como cobrados.`
        );
        this.loadTravelReport();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron marcar los viajes como cobrados.');
        this.loadingTravelReport.set(false);
      }
    });
  }

  tripLegend(row: ReporteViajeItem) {
    return `1 viaje a ${row.ruta.destino} g#${row.numeros_guia_remision.join(', ') || '-'}`;
  }

  startGuideEdit(row: ReporteViajeItem) {
    if (row.cobrado) return;

    this.guideEditTripId.set(row.id);
    this.guideInput.set('');
  }

  cancelGuideEdit() {
    this.guideEditTripId.set(null);
    this.guideInput.set('');
  }

  saveGuides(row: ReporteViajeItem) {
    if (row.cobrado) return;

    const value = this.guideInput().trim();
    if (!value) {
      this.message.set('Ingresa al menos una guia.');
      return;
    }

    this.loadingTravelReport.set(true);
    this.error.set(null);
    this.message.set(null);

    this.api
      .patch(`/viajes/${row.id}/guias`, {
        numeros_guia_remision: value
      })
      .subscribe({
        next: () => {
          this.message.set('Guías agregadas correctamente.');
          this.cancelGuideEdit();
          this.loadTravelReport();
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron agregar las guías.');
          this.loadingTravelReport.set(false);
        }
      });
  }

  editTrip(row: ReporteViajeItem) {
    const returnUrl = this.router.url.startsWith('/app/') ? this.router.url : '/app/reportes';

    void this.router.navigate(['/app/viajes'], {
      queryParams: {
        edit: row.id,
        returnUrl
      }
    });
  }

  private scheduleLoadTravelReport() {
    if (this.autoLoadTimer) {
      clearTimeout(this.autoLoadTimer);
    }

    this.autoLoadTimer = setTimeout(() => {
      this.loadTravelReport();
    }, 350);
  }

  private travelReportParams() {
    return {
      anio: this.travelForm.controls.anio.value,
      semanas: this.selectedWeeks().join(','),
      vehiculo_ids: this.selectedVehicleIds().join(','),
      cliente_ids: this.selectedClientIds().join(','),
      cobrado: this.travelForm.controls.cobrado.value
    };
  }

  private download(path: string, params: Record<string, string | number | boolean>) {
    this.error.set(null);
    this.message.set(null);
    this.downloading.set(true);

    this.api.download(path, params).subscribe({
      next: (response) => {
        const filename = this.api.filenameFromDisposition(
          response.headers.get('content-disposition'),
          'reporte'
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

  private copyTextFallback(text: string) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}
