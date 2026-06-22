import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideRefreshCw } from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { formatDateOnly } from '../../core/date-only';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';

interface AlertasResponse {
  resumen: {
    total: number;
    mantenimientos: { total: number; vencidos: number; por_vencer: number };
    licencias: { total: number; vencidas: number; por_caducar: number };
    viajes_sin_cobrar: { total: number };
    cierres_semanales: { total: number; cierres_revisados: number };
  };
  mantenimientos: unknown[];
  licencias: unknown[];
  viajes_sin_cobrar: unknown[];
  cierres_semanales: unknown[];
}

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, LucideRefreshCw, AutoDismissAlertDirective],
  templateUrl: './dashboard-page.component.html'
})
export class DashboardPageComponent {
  private readonly api = inject(ApiService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<AlertasResponse | null>(null);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.api.get<AlertasResponse>('/alertas').subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron cargar las alertas.');
        this.loading.set(false);
      }
    });
  }

  asRecord(value: unknown) {
    return value as Record<string, unknown>;
  }

  asArray(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  dateOnly(value: unknown) {
    return formatDateOnly(value);
  }
}
