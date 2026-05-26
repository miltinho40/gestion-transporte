import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { LucideRefreshCw } from '@lucide/angular';
import { ApiService } from '../../core/api.service';

interface AlertasResponse {
  resumen: {
    total: number;
    mantenimientos: { total: number; vencidos: number; por_vencer: number };
    licencias: { total: number; vencidas: number; por_caducar: number };
    viajes_sin_cobrar: { total: number };
  };
  mantenimientos: unknown[];
  licencias: unknown[];
  viajes_sin_cobrar: unknown[];
}

@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, LucideRefreshCw],
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

  asDate(value: unknown) {
    return value as string | number | Date | null | undefined;
  }
}
