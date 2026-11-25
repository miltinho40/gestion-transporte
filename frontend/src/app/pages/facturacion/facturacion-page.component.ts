import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, forkJoin } from 'rxjs';
import { LucideEye, LucideSave, LucideUndo2 } from '@lucide/angular';
import Swal from 'sweetalert2';
import { AuthService } from '../../core/auth.service';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import type { MultiSelectFilterValue } from '../../shared/multi-select-filter.component';
import {
  ViajeDetailPanelComponent,
  type ViajeDetail,
  type ViajeDetailExpense
} from '../reports/viaje-detail-panel.component';
import {
  ProveedorViajeDetailPanelComponent,
  type ProveedorViajeDetail
} from '../proveedor-transporte/proveedor-viaje-detail-panel.component';
import { FacturacionApiService } from './facturacion-api.service';
import { FacturacionTripListComponent } from './facturacion-trip-list.component';
import { FacturacionPreparationModalComponent } from './facturacion-preparation-modal.component';
import { FacturacionDetailModalComponent } from './facturacion-detail-modal.component';
import type { Cliente, Invoice, Trip } from './facturacion.models';
import { key, money, selectionState } from './facturacion.view-helpers';

@Component({
  selector: 'app-facturacion-page',
  imports: [
    FormsModule,
    LucideEye,
    LucideSave,
    LucideUndo2,
    AutoDismissAlertDirective,
    ViajeDetailPanelComponent,
    ProveedorViajeDetailPanelComponent,
    FacturacionTripListComponent,
    FacturacionPreparationModalComponent,
    FacturacionDetailModalComponent
  ],
  templateUrl: './facturacion-page.component.html'
})
export class FacturacionPageComponent {
  private readonly api = inject(FacturacionApiService);
  readonly key = key;
  readonly money = money;
  readonly billingInvoice = signal<Invoice | null>(null);
  private readonly router = inject(Router);

  readonly auth = inject(AuthService);

  private readonly destroyRef = inject(DestroyRef);

  private readonly searchChanges = new Subject<void>();

  readonly error = signal<string | null>(null);

  readonly success = signal<string | null>(null);

  readonly busy = signal(false);

  readonly clientes = signal<Cliente[]>([]);

  readonly vehiculos = signal<{ id: string; placa: string }[]>([]);

  readonly selectedClientIds = signal<string[]>([]);

  readonly selectedVehicleIds = signal<string[]>([]);

  readonly selectedWeeks = signal<number[]>([]);

  readonly trips = signal<Trip[]>([]);

  readonly invoices = signal<Invoice[]>([]);

  readonly selected = signal<Trip[]>([]);

  readonly billingOpen = signal(false);

  readonly tripLimit = signal(25);

  readonly detail = signal<Invoice | null>(null);

  readonly tripDetail = signal<ViajeDetail | null>(null);

  readonly providerDetail = signal<ProveedorViajeDetail | null>(null);

  readonly tripExpenses = signal<ViajeDetailExpense[]>([]);

  private detailSequence = 0;

  tab: 'preparar' | 'facturas' | 'configuracion' = 'preparar';

  search = '';

  ownOnly = false;

  page = 1;

  total = 0;

  invoicePage = 1;

  invoiceTotal = 0;

  private loadSequence = 0;

  canWrite() {
    return (
      this.auth.isSuperAdmin() || ['admin', 'operador'].includes(this.auth.contexto()?.rol ?? '')
    );
  }

  fail(e: any) {
    this.error.set(e?.error?.message ?? 'No se pudo completar la operación.');
    this.busy.set(false);
  }

  changeTripLimit(limit: number) {
    this.tripLimit.set(Number(limit));
    this.loadTrips(true);
  }

  searchChanged() {
    this.searchChanges.next();
  }

  setSelectedClients(values: MultiSelectFilterValue[]) {
    this.selectedClientIds.set(values.map(String));
    this.loadTrips(true);
  }

  setSelectedVehicles(values: MultiSelectFilterValue[]) {
    this.selectedVehicleIds.set(values.map(String));
    this.loadTrips(true);
  }

  setSelectedWeeks(values: MultiSelectFilterValue[]) {
    this.selectedWeeks.set(values.map(Number));
    this.loadTrips(true);
  }

  loadTrips(reset = false) {
    if (reset) this.page = 1;
    const seq = ++this.loadSequence;
    this.api
      .trips({
        search: this.search,
        page: this.page,
        limit: this.tripLimit(),
        solo_propios: this.ownOnly,
        cliente_ids: this.selectedClientIds().join(','),
        vehiculo_ids: this.selectedVehicleIds().join(','),
        semanas: this.selectedWeeks().join(',')
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (seq === this.loadSequence) {
            this.trips.set(r.items);
            this.total = r.total;
          }
        },
        error: (e) => {
          if (seq === this.loadSequence) this.fail(e);
        }
      });
  }

  private stateKey() {
    return `facturacion-edicion:${this.auth.contexto()?.propietario_id ?? ''}:${this.auth.usuario()?.id ?? ''}`;
  }

  private refreshSelected() {
    for (const row of this.selected()) {
      this.api.tripSnapshot(row).subscribe({
        next: (v) => {
          if (v.cobrado || v.estado === 'cancelado' || v.detalle_factura) {
            this.selected.update((rows) => rows.filter((t) => this.key(t) !== this.key(row)));
            return;
          }
          this.selected.update((rows) =>
            rows.map((t) =>
              this.key(t) === this.key(row)
                ? {
                    ...t,
                    cliente_id: v.cliente_id,
                    cliente: v.cliente.nombre,
                    fecha: v.fecha_salida,
                    placa: v.vehiculo?.placa ?? null,
                    ruta: `${v.tarifa_ruta.ruta.origen} - ${v.tarifa_ruta.ruta.destino}`,
                    destino: v.tarifa_ruta.ruta.destino,
                    proveedor_id: v.proveedor_id ?? null,
                    proveedor: v.proveedor?.nombre ?? null,
                    guias: v.numeros_guia_remision,
                    precio: v.precio_flete ?? v.precio_viaje
                  }
                : t
            )
          );
        },
        error: () =>
          this.selected.update((rows) => rows.filter((t) => this.key(t) !== this.key(row)))
      });
    }
  }

  editTrip(t: Trip) {
    sessionStorage.setItem(
      this.stateKey(),
      JSON.stringify({
        search: this.search,
        ownOnly: this.ownOnly,
        page: this.page,
        limit: this.tripLimit(),
        clientIds: this.selectedClientIds(),
        vehicleIds: this.selectedVehicleIds(),
        weeks: this.selectedWeeks(),
        selected: this.selected()
      })
    );
    void this.router.navigate(
      [t.tipo === 'propio' ? '/app/reportes' : '/app/proveedores/transporte'],
      { queryParams: { edit: t.id, returnUrl: '/app/facturacion' } }
    );
  }

  closeTripPreview() {
    this.detailSequence++;
    this.tripDetail.set(null);
    this.providerDetail.set(null);
    this.tripExpenses.set([]);
  }

  previewTrip(t: Trip) {
    this.closeTripPreview();
    const sequence = this.detailSequence;
    if (t.tipo === 'propio') {
      forkJoin({ viaje: this.api.ownTrip(t.id), gastos: this.api.tripExpenses(t.id) }).subscribe({
        next: (r) => {
          if (sequence === this.detailSequence) {
            this.tripDetail.set(r.viaje);
            this.tripExpenses.set(r.gastos);
          }
        },
        error: (e) => this.fail(e)
      });
    } else {
      this.api.providerTrip(t.id).subscribe({
        next: (r) => {
          if (sequence === this.detailSequence) this.providerDetail.set(r);
        },
        error: (e) => this.fail(e)
      });
    }
  }

  isSelected(t: Trip) {
    return this.selected().some((v) => this.key(v) === this.key(t));
  }

  readonly pageSelection = computed(() =>
    selectionState(this.trips(), new Set(this.selected().map(key)))
  );

  togglePageSelection() {
    const pageKeys = new Set(this.trips().map((t) => this.key(t))),
      remove = this.pageSelection().all;
    this.selected.update((rows) => {
      if (remove) return rows.filter((t) => !pageKeys.has(this.key(t)));
      const selected = new Set(rows.map((t) => this.key(t)));
      return [
        ...rows,
        ...this.trips()
          .filter((t) => !selected.has(this.key(t)))
          .map((t) => ({ ...t, comision_cliente: Number(t.comision_cliente) }))
      ];
    });
  }

  toggle(t: Trip) {
    this.selected.update((rows) =>
      this.isSelected(t)
        ? rows.filter((v) => this.key(v) !== this.key(t))
        : [...rows, { ...t, comision_cliente: Number(t.comision_cliente) }]
    );
  }

  saveConfig(c: Cliente) {
    this.busy.set(true);
    this.api.saveConfiguration(c).subscribe({
      next: (r) => {
        c.configuracion_facturacion = r;
        this.busy.set(false);
        this.success.set('Valores predeterminados guardados.');
        this.loadTrips();
      },
      error: (e) => this.fail(e)
    });
  }

  loadInvoices() {
    this.api.invoices(this.invoicePage).subscribe({
      next: (r) => {
        this.invoices.set(r.items);
        this.invoiceTotal = r.total;
      },
      error: (e) => this.fail(e)
    });
  }

  undoBlockedReason(invoice: Invoice) {
    if (invoice.abonos.length || Number(invoice.recibido) > 0)
      return 'No se puede deshacer: tiene abonos o pagos registrados.';
    if (invoice.estado === 'FACTURADA' && Number(invoice.saldo) <= 0)
      return 'No se puede deshacer: la factura está pagada.';
    return '';
  }

  async undoInvoice(invoice: Invoice) {
    if (this.busy() || !this.canWrite()) return;
    const blocked = this.undoBlockedReason(invoice);
    if (blocked) {
      this.error.set(blocked);
      return;
    }
    const result = await Swal.fire({
      title: '¿Deshacer factura?',
      text: `Se eliminará ${invoice.numero ? 'la factura ' + invoice.numero : 'el borrador #' + invoice.id} y sus viajes volverán a estar disponibles para facturar. No se eliminarán los viajes.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, deshacer',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.undoInvoice(invoice.id, invoice.version).subscribe({
      next: (r) => {
        this.busy.set(false);
        if (this.detail()?.id === invoice.id) this.detail.set(null);
        if (this.invoices().length === 1 && this.invoicePage > 1) this.invoicePage--;
        this.success.set(
          `Factura deshecha. ${r.viajes_liberados} viajes disponibles para facturar.`
        );
        this.loadInvoices();
        this.loadTrips();
      },
      error: (e) => {
        this.fail(e);
        this.loadInvoices();
      }
    });
  }
  constructor() {
    const saved = sessionStorage.getItem(this.stateKey());
    if (saved) {
      sessionStorage.removeItem(this.stateKey());
      try {
        const state = JSON.parse(saved);
        this.search = state.search;
        this.ownOnly = state.ownOnly ?? false;
        this.page = state.page;
        this.tripLimit.set([25, 50, 100].includes(state.limit) ? state.limit : 25);
        this.selectedClientIds.set(state.clientIds ?? []);
        this.selectedVehicleIds.set(state.vehicleIds ?? []);
        this.selectedWeeks.set(state.weeks ?? []);
        this.selected.set(state.selected ?? []);
        this.refreshSelected();
      } catch {
        this.selected.set([]);
      }
    }
    this.searchChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadTrips(true));
    this.api
      .configuration()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.clientes.set(rows),
        error: (error) => this.fail(error)
      });
    if (this.auth.isSuperAdmin() || this.auth.contexto()?.es_propietario) {
      this.api
        .vehicles()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (rows) => this.vehiculos.set(rows),
          error: (error) => this.fail(error)
        });
    }
    this.loadTrips();
    this.loadInvoices();
  }
  openBilling(existing?: Invoice) {
    if (!existing && !this.selected().length) return;
    this.billingInvoice.set(existing ?? null);
    this.billingOpen.set(true);
    this.detail.set(null);
    this.error.set(null);
  }
  billingSaved(closed: boolean) {
    this.billingOpen.set(false);
    this.billingInvoice.set(null);
    this.selected.set([]);
    this.success.set(
      closed ? 'Factura cerrada. Ya puedes registrar abonos.' : 'Factura guardada en preparación.'
    );
    this.tab = 'facturas';
    this.loadInvoices();
    this.loadTrips(true);
  }
  removeSelected(trip: Trip) {
    this.selected.update((rows) => rows.filter((row) => key(row) !== key(trip)));
  }
  openInvoice(invoice: Invoice) {
    this.error.set(null);
    this.detail.set(invoice);
  }
  paymentSaved() {
    this.detail.set(null);
    this.success.set('Abono registrado.');
    this.loadInvoices();
    this.loadTrips();
  }
}
