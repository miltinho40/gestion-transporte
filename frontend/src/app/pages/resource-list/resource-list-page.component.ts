import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideRefreshCw, LucideSearch } from '@lucide/angular';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import type { ApiListColumn } from '../../core/models';

interface ResourceRouteData {
  title: string;
  description: string;
  endpoint: string;
  columns: ApiListColumn[];
}

@Component({
  selector: 'app-resource-list-page',
  imports: [DatePipe, FormsModule, LucideRefreshCw, LucideSearch],
  templateUrl: './resource-list-page.component.html'
})
export class ResourceListPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly sub = new Subscription();

  readonly config = signal<ResourceRouteData | null>(null);
  readonly rows = signal<Record<string, unknown>[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly search = signal('');

  constructor() {
    this.sub.add(
      this.route.data.subscribe((data) => {
        this.config.set(data as ResourceRouteData);
        this.search.set('');
        this.load();
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  load() {
    const config = this.config();
    if (!config) return;

    this.loading.set(true);
    this.error.set(null);

    this.api.get<Record<string, unknown>[]>(config.endpoint).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron cargar los datos.');
        this.loading.set(false);
      }
    });
  }

  filteredRows() {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.rows();

    return this.rows().filter((row) => JSON.stringify(row).toLowerCase().includes(term));
  }

  value(row: Record<string, unknown>, path: string) {
    return path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return null;
      return (current as Record<string, unknown>)[key];
    }, row);
  }

  textValue(row: Record<string, unknown>, column: ApiListColumn) {
    const value = this.value(row, column.path);
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);

    return String(value);
  }

  dateValue(row: Record<string, unknown>, path: string) {
    return this.value(row, path) as string | number | Date | null | undefined;
  }

  badgeClass(value: unknown) {
    const text = String(value ?? '').toLowerCase();
    if (text.includes('venc') || text.includes('cancel') || text.includes('inactivo')) {
      return 'badge-soft-danger';
    }
    if (text.includes('curso') || text.includes('mantenimiento') || text.includes('program')) {
      return 'badge-soft-warning';
    }
    return 'badge-soft';
  }
}
