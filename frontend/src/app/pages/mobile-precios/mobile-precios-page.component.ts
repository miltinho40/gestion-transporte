import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideCopy, LucidePencil, LucidePlus, LucideRefreshCw, LucideSearch } from '@lucide/angular';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { formatDateOnly } from '../../core/date-only';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { TarifaRutaRow, numberValue } from './mobile-precios.types';

const searchText = (...values: unknown[]) =>
  values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .join(' ')
    .toLowerCase();

@Component({
  selector: 'app-mobile-precios-page',
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
  templateUrl: './mobile-precios-page.component.html',
  styleUrl: './mobile-precios-page.component.scss'
})
export class MobilePreciosPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly sub = new Subscription();

  readonly rows = signal<TarifaRutaRow[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly activa = signal('');
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
      this.api.get<TarifaRutaRow[]>('/tarifas-ruta').subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los precios.');
          this.loading.set(false);
        }
      })
    );
  }

  filteredRows() {
    const term = this.search().trim().toLowerCase();
    const activa = this.activa();

    return this.rows()
      .filter((row) => activa === '' || String(row.activa) === activa)
      .filter((row) => !term || this.rowSearchText(row).includes(term));
  }

  edit(row: TarifaRutaRow) {
    void this.router.navigate(['/movil/precios', row.id, 'editar']);
  }

  duplicate(row: TarifaRutaRow) {
    void this.router.navigate(['/movil/precios/nuevo'], {
      queryParams: { duplicateFrom: row.id }
    });
  }

  rutaLabel(row: TarifaRutaRow) {
    return `${row.ruta.origen} - ${row.ruta.destino}`;
  }

  money(value: unknown) {
    return numberValue(value).toFixed(2);
  }

  dateOnly(value: unknown) {
    return formatDateOnly(value);
  }

  private rowSearchText(row: TarifaRutaRow) {
    return searchText(
      row.ruta.origen,
      row.ruta.destino,
      row.tipo_carga.nombre,
      row.capacidad,
      row.toneladas,
      row.precio
    );
  }
}
