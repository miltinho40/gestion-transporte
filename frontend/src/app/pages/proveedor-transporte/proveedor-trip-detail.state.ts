import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProveedorTransporteApiService } from './proveedor-transporte-api.service';
import type { ProveedorViajeDetail } from './proveedor-viaje-detail-panel.component';

@Injectable()
export class ProveedorTripDetailState {
  private readonly api = inject(ProveedorTransporteApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly open = signal(false);
  readonly rowId = signal<string | null>(null);
  readonly viaje = signal<ProveedorViajeDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private sequence = 0;
  private readonly cache = new Map<string, ProveedorViajeDetail>();
  show(id: string) {
    this.open.set(true);
    this.rowId.set(id);
    this.error.set(null);
    const cached = this.cache.get(id);
    if (cached) {
      this.viaje.set(cached);
      this.loading.set(false);
      return;
    }
    this.viaje.set(null);
    this.loading.set(true);
    const sequence = ++this.sequence;
    this.api
      .detail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          if (sequence !== this.sequence || !this.open() || this.rowId() !== id) return;
          this.cache.set(id, detail);
          this.viaje.set(detail);
          this.loading.set(false);
        },
        error: (err) => {
          if (sequence !== this.sequence || this.rowId() !== id) return;
          this.error.set(err?.error?.message ?? 'No se pudo cargar el detalle del viaje.');
          this.loading.set(false);
        }
      });
  }
  close() {
    this.sequence++;
    this.open.set(false);
    this.rowId.set(null);
    this.viaje.set(null);
    this.loading.set(false);
    this.error.set(null);
  }
  reset() {
    this.cache.clear();
    if (this.open()) this.close();
  }
}
