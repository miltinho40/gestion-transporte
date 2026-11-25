import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LucidePlus } from '@lucide/angular';
import { debounceTime, forkJoin } from 'rxjs';
import { isPaginatedResponse, type PaginationMeta } from '../../core/pagination';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { DialogService, type SupportPromptResult } from '../../shared/dialog.service';
import type { MultiSelectFilterValue } from '../../shared/multi-select-filter.component';
import { ProveedorViajeDetailPanelComponent } from './proveedor-viaje-detail-panel.component';
import { ProveedorTransporteApiService } from './proveedor-transporte-api.service';
import { ProveedorTripDetailState } from './proveedor-trip-detail.state';
import { ProveedorTripListComponent } from './proveedor-trip-list.component';
import { ProveedorViajeEditorModalComponent } from './proveedor-viaje-editor-modal.component';
import type {
  ClienteOption,
  ProveedorOption,
  ProveedorEditorRequest,
  ProveedorRowAction,
  ProveedorBulkAction,
  ProveedorSupportOperation,
  TarifaRutaOption,
  ViajeProveedorRow
} from './proveedor-transporte.models';
import {
  providerPaymentText,
  providerPaymentImage,
  copyTextFallback
} from './proveedor-payment-export';
import { todayInputDate } from './proveedor-transporte.helpers';

@Component({
  selector: 'app-proveedor-transporte-page',
  imports: [
    LucidePlus,
    AutoDismissAlertDirective,
    ProveedorTripListComponent,
    ProveedorViajeEditorModalComponent,
    ProveedorViajeDetailPanelComponent
  ],
  providers: [ProveedorTripDetailState],
  templateUrl: './proveedor-transporte-page.component.html'
})
export class ProveedorTransportePageComponent {
  private readonly api = inject(ProveedorTransporteApiService);
  readonly detail = inject(ProveedorTripDetailState);
  readonly editorRequest = signal<ProveedorEditorRequest | null>(null);
  readonly formOpen = computed(() => this.editorRequest() !== null);
  readonly detailOpen = this.detail.open;
  readonly detailRowId = this.detail.rowId;
  private readonly dialog = inject(DialogService);

  private readonly fb = inject(FormBuilder);

  private readonly destroyRef = inject(DestroyRef);

  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);

  readonly message = signal<string | null>(null);

  readonly loading = signal(false);

  readonly deletingId = signal<string | null>(null);

  readonly rows = signal<ViajeProveedorRow[]>([]);

  readonly pagination = signal<PaginationMeta | null>(null);

  readonly page = signal(1);

  readonly limit = signal(25);

  readonly clientes = signal<ClienteOption[]>([]);

  readonly proveedores = signal<ProveedorOption[]>([]);

  readonly tarifasRuta = signal<TarifaRutaOption[]>([]);

  readonly selectedIds = signal<string[]>([]);

  readonly selectedClientIds = signal<string[]>([]);

  readonly selectedProviderIds = signal<string[]>([]);

  readonly guideEditTripId = signal<string | null>(null);

  readonly guideInput = signal('');

  private autoLoadTimer: ReturnType<typeof setTimeout> | null = null;

  readonly filters = this.fb.nonNullable.group({
    search: [''],
    cobrado: [''],
    pagado_proveedor: [''],
    mostrar_finalizados: [false],
    numero_semana: [''],
    anio_semana: [new Date().getFullYear()]
  });

  readonly selectedRows = computed(() => {
    const ids = new Set(this.selectedIds());
    return this.rows().filter((row) => ids.has(row.id));
  });

  load() {
    this.detail.reset();
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);

    this.api
      .list({
        ...this.filters.getRawValue(),
        cliente_ids: this.selectedClientIds().join(','),
        proveedor_ids: this.selectedProviderIds().join(','),
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
          this.selectedIds.set([]);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los viajes de proveedores.');
          this.rows.set([]);
          this.pagination.set(null);
          this.loading.set(false);
        }
      });
  }

  async revertirCobro(row: ViajeProveedorRow) {
    if (!row.cobrado || row.estado === 'cancelado') return;

    const confirmed = await this.dialog.confirm({
      title: 'Regresar viaje a sin cobrar',
      text: `Se quitará el cobro registrado para ${row.cliente?.nombre ?? 'este cliente'} y se limpiará la fecha/soporte de cobro.`,
      confirmText: 'Sí, regresar'
    });
    if (!confirmed) return;

    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);

    this.api.revertCollection(row.id).subscribe({
      next: () => {
        this.message.set('Viaje regresado a sin cobrar.');
        this.load();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo regresar el viaje a sin cobrar.');
        this.loading.set(false);
      }
    });
  }

  async marcarSeleccionadosCobrados() {
    const rows = this.selectedRows().filter((row) => !row.cobrado && row.estado !== 'cancelado');
    if (!rows.length) {
      this.message.set('Selecciona viajes pendientes de cobro.');
      return;
    }

    const support = await this.dialog.supportPrompt({
      title: 'Marcar viajes como cobrados',
      text: `Se marcaran ${rows.length} ${rows.length === 1 ? 'viaje' : 'viajes'} como cobrados.`,
      dateLabel: 'Fecha de cobro',
      supportLabel: 'Número de factura / soporte',
      noInvoiceLabel: 'No se emitio factura',
      confirmText: 'Marcar cobrados',
      defaultDate: todayInputDate()
    });
    if (!support) return;

    this.bulkPatch(
      rows.map((row) => row.id),
      'cobro',
      support,
      `${rows.length} ${rows.length === 1 ? 'viaje marcado' : 'viajes marcados'} como cobrados.`
    );
  }

  async marcarSeleccionadosPagados() {
    const rows = this.selectedRows().filter(
      (row) => !row.pagado_proveedor && row.estado !== 'cancelado'
    );
    if (!rows.length) {
      this.message.set('Selecciona viajes pendientes de pago.');
      return;
    }

    const support = await this.dialog.supportPrompt({
      title: 'Marcar viajes como pagados',
      text: `Se registrara el pago de ${rows.length} ${rows.length === 1 ? 'viaje' : 'viajes'} a proveedores.`,
      dateLabel: 'Fecha de pago',
      supportLabel: 'Número de factura / soporte',
      noInvoiceLabel: 'Proveedor no emitio factura',
      confirmText: 'Marcar pagados',
      defaultDate: todayInputDate()
    });
    if (!support) return;

    this.bulkPatch(
      rows.map((row) => row.id),
      'pago',
      support,
      `${rows.length} ${rows.length === 1 ? 'viaje marcado' : 'viajes marcados'} como pagados.`
    );
  }

  async copySelectedLegend() {
    const rows = this.selectedRows();
    if (!rows.length) {
      this.message.set('Selecciona al menos un viaje.');
      return;
    }

    const proveedorIds = new Set(rows.map((row) => row.proveedor.id));
    if (proveedorIds.size > 1) {
      this.error.set('Selecciona viajes de un solo proveedor para generar la imagen.');
      return;
    }

    const text = providerPaymentText(rows);

    try {
      const image = await providerPaymentImage(rows);
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
        this.message.set('Imagen copiada al portapapeles.');
      } else {
        copyTextFallback(text);
        this.message.set('El navegador no permite copiar imagen; se copió el texto.');
      }
    } catch {
      copyTextFallback(text);
      this.message.set('No se pudo copiar la imagen; se copió el texto.');
    }
  }

  startGuideEdit(row: ViajeProveedorRow) {
    if (row.cobrado || row.estado === 'cancelado') return;

    this.guideEditTripId.set(row.id);
    this.guideInput.set('');
  }

  cancelGuideEdit() {
    this.guideEditTripId.set(null);
    this.guideInput.set('');
  }

  saveGuides(row: ViajeProveedorRow) {
    if (row.cobrado || row.estado === 'cancelado') return;

    const value = this.guideInput().trim();
    if (!value) {
      this.message.set('Ingresa al menos una guia.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);

    this.api.guides(row.id, value).subscribe({
      next: () => {
        this.message.set('Guías agregadas correctamente.');
        this.cancelGuideEdit();
        this.load();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron agregar las guías.');
        this.loading.set(false);
      }
    });
  }

  async delete(row: ViajeProveedorRow) {
    const confirmed = await this.dialog.confirm({
      title: row.estado === 'cancelado' ? 'Eliminar viaje definitivamente' : 'Cancelar viaje',
      text:
        row.estado === 'cancelado'
          ? 'El viaje ya está cancelado. Se eliminará de la tabla.'
          : 'El viaje quedara con estado cancelado.',
      confirmText: row.estado === 'cancelado' ? 'Eliminar' : 'Cancelar viaje'
    });
    if (!confirmed) return;

    this.deletingId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.api.remove(row.id).subscribe({
      next: () => {
        this.message.set(row.estado === 'cancelado' ? 'Viaje eliminado.' : 'Viaje cancelado.');
        this.deletingId.set(null);
        this.load();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo procesar el viaje.');
        this.deletingId.set(null);
      }
    });
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

  setSelectedClients(values: MultiSelectFilterValue[]) {
    this.selectedClientIds.set(values.map(String));
    this.page.set(1);
    this.scheduleLoad();
  }

  setSelectedProviders(values: MultiSelectFilterValue[]) {
    this.selectedProviderIds.set(values.map(String));
    this.page.set(1);
    this.scheduleLoad();
  }

  toggleSelection(row: ViajeProveedorRow, checked: boolean) {
    this.selectedIds.update((current) => {
      const ids = new Set(current);
      if (checked) {
        ids.add(row.id);
      } else {
        ids.delete(row.id);
      }
      return [...ids];
    });
  }

  toggleAllVisible(checked: boolean) {
    this.selectedIds.set(checked ? this.rows().map((row) => row.id) : []);
  }

  private scheduleLoad() {
    if (this.autoLoadTimer) {
      clearTimeout(this.autoLoadTimer);
    }

    this.autoLoadTimer = setTimeout(() => this.load(), 350);
  }

  private bulkPatch(
    ids: string[],
    operation: ProveedorSupportOperation,
    support: SupportPromptResult,
    successMessage: string
  ) {
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);

    forkJoin(ids.map((id) => this.api.support(id, operation, support))).subscribe({
      next: () => {
        this.message.set(successMessage);
        this.load();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron procesar los viajes seleccionados.');
        this.loading.set(false);
      }
    });
  }
  constructor() {
    const query = this.route.snapshot.queryParamMap;
    this.selectedClientIds.set(query.get('cliente_ids')?.split(',').filter(Boolean) ?? []);
    this.selectedProviderIds.set(query.get('proveedor_ids')?.split(',').filter(Boolean) ?? []);
    this.filters.patchValue(
      {
        search: query.get('search') ?? '',
        cobrado: query.get('cobrado') ?? '',
        pagado_proveedor: query.get('pagado_proveedor') ?? '',
        mostrar_finalizados: query.get('mostrar_finalizados') === 'true',
        numero_semana: query.get('numero_semana') ?? '',
        anio_semana: Number(query.get('anio_semana')) || new Date().getFullYear()
      },
      { emitEvent: false }
    );
    this.loadCatalogs();
    this.load();
    if (query.get('new') === '1') this.openCreate(this.route.snapshot.queryParams);
    this.filters.valueChanges
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.scheduleLoad();
      });
    this.destroyRef.onDestroy(() => {
      if (this.autoLoadTimer) clearTimeout(this.autoLoadTimer);
    });
  }
  loadCatalogs() {
    forkJoin({
      clientes: this.api.clients(),
      proveedores: this.api.providers(),
      tarifasRuta: this.api.prices()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalogs) => {
          this.clientes.set(catalogs.clientes);
          this.proveedores.set(catalogs.proveedores);
          this.tarifasRuta.set(catalogs.tarifasRuta);
          const id = this.route.snapshot.queryParamMap.get('edit');
          if (id)
            this.api
              .trip(id)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (row) => this.openEdit(row),
                error: (err) => this.error.set(err?.error?.message ?? 'No se pudo abrir el viaje.')
              });
        },
        error: (err) =>
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los catálogos.')
      });
  }
  openCreate(prefill?: Record<string, string | null>) {
    this.detail.close();
    this.editorRequest.set({ mode: 'create', prefill });
  }
  openEdit(row: ViajeProveedorRow) {
    this.detail.close();
    this.editorRequest.set({ mode: 'edit', row });
  }
  openDuplicate(row: ViajeProveedorRow) {
    this.detail.close();
    this.editorRequest.set({ mode: 'duplicate', row });
  }
  openTripDetail(row: ViajeProveedorRow) {
    this.detail.show(row.id);
  }
  closeForm() {
    this.editorRequest.set(null);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) void this.router.navigateByUrl(returnUrl);
  }
  formSaved(message: string) {
    this.message.set(message);
    this.closeForm();
    this.load();
  }
  handleRowAction(action: ProveedorRowAction) {
    const row = action.row;
    switch (action.type) {
      case 'detail':
        this.openTripDetail(row);
        break;
      case 'duplicate':
        this.openDuplicate(row);
        break;
      case 'edit':
        this.openEdit(row);
        break;
      case 'revert-collection':
        void this.revertirCobro(row);
        break;
      case 'guides':
        this.startGuideEdit(row);
        break;
      case 'save-guides':
        this.saveGuides(row);
        break;
      case 'delete':
        void this.delete(row);
        break;
    }
  }
  handleBulkAction(action: ProveedorBulkAction) {
    switch (action) {
      case 'reload':
        this.load();
        break;
      case 'collect':
        void this.marcarSeleccionadosCobrados();
        break;
      case 'pay':
        void this.marcarSeleccionadosPagados();
        break;
      case 'copy':
        void this.copySelectedLegend();
        break;
    }
  }
}
