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
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import {
  EstadoMantenimiento,
  MantenimientoRow,
  TipoMantenimientoOption,
  VehiculoOption,
  dateSortValue,
  estadoMantenimientoLabel,
  numberValue
} from './mobile-mantenimientos.types';

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
    AutoDismissAlertDirective
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

  constructor() {
    this.load();
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.sub.add(
      forkJoin({
        mantenimientos: this.api.get<MantenimientoRow[]>('/mantenimientos'),
        vehiculos: this.api.get<VehiculoOption[]>('/vehiculos'),
        tipos: this.api.get<TipoMantenimientoOption[]>('/tipos-mantenimiento', { activo: true })
      }).subscribe({
        next: ({ mantenimientos, vehiculos, tipos }) => {
          this.rows.set(mantenimientos);
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
    const term = this.search().trim().toLowerCase();
    const estado = this.estado();

    return this.rows()
      .filter((row) => !estado || row.estado === estado)
      .filter((row) => !term || this.rowSearchText(row).includes(term))
      .sort(
        (left, right) =>
          dateSortValue(right.fecha_mantenimiento) -
            dateSortValue(left.fecha_mantenimiento) || Number(right.id) - Number(left.id)
      );
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
}
