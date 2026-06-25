import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideCheck,
  LucideClipboardList,
  LucideCopy,
  LucideDollarSign,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch
} from '@lucide/angular';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { formatDateOnly } from '../../core/date-only';
import { isPaginatedResponse, PaginatedResponse, PaginationMeta } from '../../core/pagination';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { DialogService } from '../../shared/dialog.service';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';
import {
  ViajeProveedorRow,
  dateSortValue,
  isoWeekInfo,
  numberValue,
  todayInputDate
} from './mobile-proveedor-viajes.types';

type ViajesProveedorListResponse = ViajeProveedorRow[] | PaginatedResponse<ViajeProveedorRow>;

@Component({
  selector: 'app-mobile-proveedor-viajes-page',
  imports: [
    FormsModule,
    RouterLink,
    LucideCheck,
    LucideClipboardList,
    LucideCopy,
    LucideDollarSign,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    AutoDismissAlertDirective,
    PaginationControlsComponent
  ],
  templateUrl: './mobile-proveedor-viajes-page.component.html',
  styleUrl: './mobile-proveedor-viajes-page.component.scss'
})
export class MobileProveedorViajesPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly sub = new Subscription();

  readonly rows = signal<ViajeProveedorRow[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly cobrado = signal('');
  readonly pagado = signal('');
  readonly markingCobroId = signal<string | null>(null);
  readonly markingPagoId = signal<string | null>(null);
  readonly savingGuidesId = signal<string | null>(null);
  readonly guideRow = signal<ViajeProveedorRow | null>(null);
  readonly guideInput = signal('');
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
      this.api
        .get<ViajesProveedorListResponse>('/viajes-proveedor', {
          search: this.search().trim(),
          cobrado: this.cobrado(),
          pagado_proveedor: this.pagado(),
          page: this.page(),
          limit: this.limit()
        })
        .subscribe({
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
            this.error.set(err?.error?.message ?? 'No se pudieron cargar los viajes de proveedores.');
            this.loading.set(false);
          }
        })
    );
  }

  filteredRows() {
    return [...this.rows()].sort((left, right) => {
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

  setPagado(value: string) {
    this.pagado.set(value);
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

  edit(row: ViajeProveedorRow) {
    void this.router.navigate(['/movil/viajes-proveedores', row.id, 'editar']);
  }

  duplicate(row: ViajeProveedorRow) {
    void this.router.navigate(['/movil/viajes-proveedores/nuevo'], {
      queryParams: { duplicateFrom: row.id }
    });
  }

  async marcarCobrado(row: ViajeProveedorRow) {
    if (row.cobrado || row.estado === 'cancelado') return;

    const support = await this.dialog.supportPrompt({
      title: 'Marcar viaje como cobrado',
      text: `Se registrará el cobro del viaje de ${row.cliente?.nombre ?? 'este cliente'}.`,
      dateLabel: 'Fecha de cobro',
      supportLabel: 'Número de factura / soporte',
      noInvoiceLabel: 'No se emitió factura',
      confirmText: 'Marcar cobrado',
      defaultDate: todayInputDate()
    });
    if (!support) return;

    this.markingCobroId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api.patch<ViajeProveedorRow>(`/viajes-proveedor/${row.id}/cobro`, support).subscribe({
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

  async marcarPagado(row: ViajeProveedorRow) {
    if (row.pagado_proveedor || row.estado === 'cancelado') return;

    const support = await this.dialog.supportPrompt({
      title: 'Marcar proveedor como pagado',
      text: `Se registrará el pago a ${row.proveedor?.nombre ?? 'este proveedor'}.`,
      dateLabel: 'Fecha de pago',
      supportLabel: 'Número de factura / soporte',
      noInvoiceLabel: 'Proveedor no emitió factura',
      confirmText: 'Marcar pagado',
      defaultDate: todayInputDate()
    });
    if (!support) return;

    this.markingPagoId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api.patch<ViajeProveedorRow>(`/viajes-proveedor/${row.id}/pago`, support).subscribe({
        next: () => {
          this.markingPagoId.set(null);
          this.message.set('Viaje marcado como pagado.');
          this.load();
        },
        error: (err) => {
          this.markingPagoId.set(null);
          this.error.set(err?.error?.message ?? 'No se pudo marcar el viaje como pagado.');
        }
      })
    );
  }

  openGuides(row: ViajeProveedorRow) {
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
        .patch<ViajeProveedorRow>(`/viajes-proveedor/${row.id}/guias`, {
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

  rutaLabel(row: ViajeProveedorRow) {
    return `${row.tarifa_ruta?.ruta?.origen ?? '-'} - ${row.tarifa_ruta?.ruta?.destino ?? '-'}`;
  }

  guiasLabel(row: ViajeProveedorRow) {
    return (row.numeros_guia_remision ?? []).join(', ');
  }

  semanaLabel(row: ViajeProveedorRow) {
    return isoWeekInfo(row.fecha_llegada || row.fecha_salida).label;
  }

  private scheduleFilteredLoad() {
    this.page.set(1);
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => this.load(), 350);
  }
}
