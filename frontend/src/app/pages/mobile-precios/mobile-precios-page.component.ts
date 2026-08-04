import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideCopy, LucidePencil, LucidePlus, LucideRefreshCw, LucideSearch } from '@lucide/angular';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { isPaginatedResponse, PaginatedResponse, PaginationMeta } from '../../core/pagination';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';
import { TarifaRutaRow, numberValue } from './mobile-precios.types';

type TarifaRutaListResponse = TarifaRutaRow[] | PaginatedResponse<TarifaRutaRow>;

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
    AutoDismissAlertDirective,
    PaginationControlsComponent
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
      this.api.get<TarifaRutaListResponse>('/tarifas-ruta', {
        search: this.search().trim(),
        activa: this.activa(),
        page: this.page(),
        limit: this.limit()
      }).subscribe({
        next: (response) => {
          if (isPaginatedResponse(response)) {
            this.rows.set(response.data);
            this.pagination.set(response.meta);
          } else {
            this.rows.set(response);
            this.pagination.set(null);
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los precios.');
          this.pagination.set(null);
          this.loading.set(false);
        }
      })
    );
  }

  filteredRows() {
    return this.rows();
  }

  totalCount() {
    return this.pagination()?.total ?? this.rows().length;
  }

  setSearch(value: string) {
    this.search.set(value);
    this.scheduleFilteredLoad();
  }

  setActiva(value: string) {
    this.activa.set(value);
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

  private scheduleFilteredLoad() {
    this.page.set(1);
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => this.load(), 350);
  }
}
