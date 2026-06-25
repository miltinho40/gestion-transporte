import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
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
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';
import {
  EstadoMantenimiento,
  MantenimientoRow,
  TipoMantenimientoOption,
  VehiculoOption,
  dateSortValue,
  estadoMantenimientoLabel,
  numberValue
} from './mobile-mantenimientos.types';

type MantenimientosListResponse = MantenimientoRow[] | PaginatedResponse<MantenimientoRow>;

const searchText = (...values: unknown[]) =>
  values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .join(' ')
    .toLowerCase();

@Component({
  selector: 'app-mobile-mantenimientos-page',
  imports: [
    FormsModule,
    RouterLink,
    LucideCopy,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    AutoDismissAlertDirective,
    PaginationControlsComponent
  ],
  templateUrl: './mobile-mantenimientos-page.component.html',
  styleUrl: './mobile-mantenimientos-page.component.scss'
})
export class MobileMantenimientosPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly sub = new Subscription();

  readonly rows = signal<MantenimientoRow[]>([]);
  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly tipos = signal<TipoMantenimientoOption[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly estado = signal('');
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
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
        mantenimientos: this.api.get<MantenimientosListResponse>('/mantenimientos', {
          search: this.search().trim(),
          estado: this.estado(),
          page: this.page(),
          limit: this.limit()
        }),
        vehiculos: this.api.get<VehiculoOption[]>('/vehiculos'),
        tipos: this.api.get<TipoMantenimientoOption[]>('/tipos-mantenimiento', { activo: true })
      }).subscribe({
        next: ({ mantenimientos, vehiculos, tipos }) => {
          if (isPaginatedResponse(mantenimientos)) {
            this.rows.set(mantenimientos.data);
            this.pagination.set(mantenimientos.meta);
          } else {
            this.rows.set(mantenimientos);
            this.pagination.set(null);
          }
          this.vehiculos.set(vehiculos);
          this.tipos.set(tipos);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los mantenimientos.');
          this.loading.set(false);
        }
      })
    );
  }

  filteredRows() {
    return this.rows()
      .sort(
        (left, right) =>
          dateSortValue(right.fecha_mantenimiento) -
            dateSortValue(left.fecha_mantenimiento) || Number(right.id) - Number(left.id)
      );
  }

  totalCount() {
    return this.pagination()?.total ?? this.rows().length;
  }

  setSearch(value: string) {
    this.search.set(value);
    this.scheduleFilteredLoad();
  }

  setEstado(value: string) {
    this.estado.set(value);
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

  edit(row: MantenimientoRow) {
    void this.router.navigate(['/movil/mantenimientos', row.id, 'editar']);
  }

  duplicate(row: MantenimientoRow) {
    void this.router.navigate(['/movil/mantenimientos/nuevo'], {
      queryParams: { duplicateFrom: row.id }
    });
  }

  money(value: unknown) {
    return numberValue(value).toFixed(2);
  }

  dateOnly(value: unknown) {
    return formatDateOnly(value);
  }

  estadoLabel(estado: EstadoMantenimiento) {
    return estadoMantenimientoLabel(estado);
  }

  vehiculoLabel(row: MantenimientoRow) {
    const vehiculo = row.vehiculo;
    if (!vehiculo) return '-';
    return [vehiculo.placa, vehiculo.marca].filter(Boolean).join(' - ');
  }

  tipoLabel(row: MantenimientoRow) {
    return row.tipo_mantenimiento?.nombre ?? '-';
  }

  badgeClass(row: MantenimientoRow) {
    if (row.estado === 'cancelado' || row.estado === 'vencido') return 'danger';
    if (row.estado === 'programado') return 'warning';
    return 'ok';
  }

  private rowSearchText(row: MantenimientoRow) {
    return searchText(
      row.vehiculo?.placa,
      row.vehiculo?.marca,
      row.vehiculo?.modelo,
      row.tipo_mantenimiento?.nombre,
      row.descripcion,
      row.repuestos?.map((item) => item.nombre_repuesto).join(' ')
    );
  }

  private scheduleFilteredLoad() {
    this.page.set(1);
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => this.load(), 350);
  }
}
