import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideCheck,
  LucideClipboardList,
  LucideCopy,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch
} from '@lucide/angular';
import { Subscription, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { formatDateOnly } from '../../core/date-only';
import { isPaginatedResponse, PaginatedResponse, PaginationMeta } from '../../core/pagination';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { DialogService } from '../../shared/dialog.service';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';
import {
  ClienteOption,
  VehiculoOption,
  ViajeRow,
  dateSortValue,
  isoWeekInfo,
  numberValue
} from './mobile-viajes.types';

type ViajesListResponse = ViajeRow[] | PaginatedResponse<ViajeRow>;

const searchText = (...values: unknown[]) =>
  values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .join(' ')
    .toLowerCase();

const todayInputDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

@Component({
  selector: 'app-mobile-viajes-page',
  imports: [
    FormsModule,
    RouterLink,
    LucideCheck,
    LucideClipboardList,
    LucideCopy,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    AutoDismissAlertDirective,
    PaginationControlsComponent
  ],
  templateUrl: './mobile-viajes-page.component.html',
  styleUrl: './mobile-viajes-page.component.scss'
})
export class MobileViajesPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly sub = new Subscription();

  readonly rows = signal<ViajeRow[]>([]);
  readonly clientes = signal<ClienteOption[]>([]);
  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly loading = signal(false);
  readonly markingCobroId = signal<string | null>(null);
  readonly savingGuidesId = signal<string | null>(null);
  readonly search = signal('');
  readonly cobrado = signal('false');
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly guideRow = signal<ViajeRow | null>(null);
  readonly guideInput = signal('');
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly page = signal(1);
  readonly limit = signal(10);
  private filterTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    if (this.filterTimer) clearTimeout(this.filterTimer);
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.sub.add(
      forkJoin({
        viajes: this.api.get<ViajesListResponse>('/viajes', {
          search: this.search().trim(),
          cobrado: this.cobrado(),
          page: this.page(),
          limit: this.limit()
        }),
        clientes: this.api.get<ClienteOption[]>('/clientes', {
          activo: true,
          solo_propios: true
        }),
        vehiculos: this.api.get<VehiculoOption[]>('/vehiculos', { solo_propios: true })
      }).subscribe({
        next: ({ viajes, clientes, vehiculos }) => {
          if (isPaginatedResponse(viajes)) {
            this.rows.set(viajes.data);
            this.pagination.set(viajes.meta);
          } else {
            this.rows.set(viajes);
            this.pagination.set(null);
          }
          this.clientes.set(clientes);
          this.vehiculos.set(vehiculos);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los viajes.');
          this.loading.set(false);
        }
      })
    );
  }

  filteredRows() {
    return this.rows()
      .sort((left, right) => {
        const rightDate = right.fecha_llegada || right.fecha_salida;
        const leftDate = left.fecha_llegada || left.fecha_salida;
        return dateSortValue(rightDate) - dateSortValue(leftDate) || Number(right.id) - Number(left.id);
      });
  }

  totalCount() {
    return this.pagination()?.total ?? this.rows().length;
  }

  setSearch(value: string) {
    this.search.set(value);
    this.scheduleFilteredLoad();
  }

  setCobrado(value: string) {
    this.cobrado.set(value);
    this.scheduleFilteredLoad();
  }

  changePage(page: number) {
    const meta = this.pagination();
    if (!meta || page < 1 || page > meta.total_pages || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  changeLimit(limit: number) {
    this.limit.set(Number(limit));
    this.page.set(1);
    this.load();
  }

  async marcarCobrado(row: ViajeRow) {
    if (row.cobrado || row.estado === 'cancelado') return;

    const support = await this.dialog.supportPrompt({
      title: 'Marcar viaje como cobrado',
      text: `Se registrara la fecha de cobro de hoy para ${row.cliente?.nombre ?? 'este viaje'}.`,
      confirmText: 'Marcar cobrado'
    });

    if (!support) return;

    this.markingCobroId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api
        .patch<ViajeRow>(`/viajes/${row.id}/cobro`, {
          cobrado: true,
          fecha_cobro: support.fecha,
          soporte_cobro: support.soporte,
          sin_factura_cobro: support.sin_factura
        })
        .subscribe({
          next: () => {
            this.markingCobroId.set(null);
            this.message.set('Viaje marcado como cobrado.');
            this.load();
          },
          error: (err) => {
            this.markingCobroId.set(null);
            this.error.set(err?.error?.message ?? 'No se pudo marcar el viaje como cobrado.');
          }
        })
    );
  }

  edit(row: ViajeRow) {
    void this.router.navigate(['/movil/viajes', row.id, 'editar']);
  }

  duplicate(row: ViajeRow) {
    void this.router.navigate(['/movil/viajes/nuevo'], {
      queryParams: { duplicateFrom: row.id }
    });
  }

  openGuides(row: ViajeRow) {
    if (row.cobrado || row.estado === 'cancelado') return;

    this.guideRow.set(row);
    this.guideInput.set('');
    this.message.set(null);
    this.error.set(null);
  }

  closeGuides() {
    this.guideRow.set(null);
    this.guideInput.set('');
  }

  saveGuides() {
    const row = this.guideRow();
    const value = this.guideInput().trim();
    if (!row || !value) {
      this.error.set('Ingresa al menos una guía.');
      return;
    }

    this.savingGuidesId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api
        .patch<ViajeRow>(`/viajes/${row.id}/guias`, {
          numeros_guia_remision: value
        })
        .subscribe({
          next: () => {
            this.savingGuidesId.set(null);
            this.closeGuides();
            this.message.set('Guías agregadas al viaje.');
            this.load();
          },
          error: (err) => {
            this.savingGuidesId.set(null);
            this.error.set(err?.error?.message ?? 'No se pudieron agregar las guías.');
          }
        })
    );
  }

  money(value: unknown) {
    return numberValue(value).toFixed(2);
  }

  dateOnly(value: unknown) {
    return formatDateOnly(value);
  }

  rutaLabel(row: ViajeRow) {
    const tarifa = row.tarifa_ruta;
    if (!tarifa) return '-';
    return `${tarifa.ruta.origen} - ${tarifa.ruta.destino}`;
  }

  guiasLabel(row: ViajeRow) {
    return (row.numeros_guia_remision ?? []).join(', ');
  }

  semanaLabel(row: ViajeRow) {
    return isoWeekInfo(row.fecha_llegada || row.fecha_salida).label;
  }

  utilidad(row: ViajeRow) {
    return numberValue(row.precio_real_flete) - numberValue(row.costo_real_gastos);
  }

  clienteFilterLabel(cliente: ClienteOption) {
    return `${cliente.nombre} - ${cliente.ruc_cedula}`;
  }

  vehiculoFilterLabel(vehiculo: VehiculoOption) {
    return [vehiculo.placa, vehiculo.marca].filter(Boolean).join(' - ');
  }

  private rowSearchText(row: ViajeRow) {
    return searchText(
      row.cliente?.nombre,
      row.cliente?.ruc_cedula,
      row.vehiculo?.placa,
      row.vehiculo?.marca,
      row.conductor?.nombre,
      this.rutaLabel(row),
      row.numeros_guia_remision?.join(' '),
      row.descripcion_carga
    );
  }

  private scheduleFilteredLoad() {
    this.page.set(1);
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => this.load(), 350);
  }
}
