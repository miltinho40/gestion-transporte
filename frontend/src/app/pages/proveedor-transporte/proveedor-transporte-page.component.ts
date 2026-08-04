import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideCheck,
  LucideCopy,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideRotateCcw,
  LucideSearch,
  LucideTrash2
} from '@lucide/angular';
import { debounceTime, forkJoin } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { formatDateOnly } from '../../core/date-only';
import { isPaginatedResponse, PaginatedResponse, PaginationMeta } from '../../core/pagination';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { DialogService, SupportPromptResult } from '../../shared/dialog.service';
import {
  MultiSelectFilterComponent,
  type MultiSelectFilterValue
} from '../../shared/multi-select-filter.component';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';

interface ClienteOption {
  id: string;
  nombre: string;
  ruc_cedula: string;
  porcentaje_comision: string | number;
}

interface ProveedorOption {
  id: string;
  nombre: string;
  ruc_cedula: string;
  porcentaje_utilidad: string | number;
}

interface TarifaRutaOption {
  id: string;
  precio: string | number;
  ruta: {
    origen: string;
    destino: string;
  };
  tipo_carga: {
    nombre: string;
  };
  capacidad?: string | null;
}

interface ViajeProveedorRow {
  id: string;
  cliente: ClienteOption;
  proveedor: ProveedorOption;
  tarifa_ruta: TarifaRutaOption;
  cliente_id: string;
  proveedor_id: string;
  tarifa_ruta_id: string;
  fecha_salida: string;
  fecha_llegada?: string | null;
  descripcion_carga?: string | null;
  numeros_guia_remision: string[];
  precio_viaje: string | number;
  valor_a_facturar: string | number;
  precio_pagar_proveedor: string | number;
  viaticos: string | number;
  utilidad: string | number;
  cobrado: boolean;
  fecha_cobro?: string | null;
  soporte_cobro?: string | null;
  sin_factura_cobro: boolean;
  pagado_proveedor: boolean;
  fecha_pago_proveedor?: string | null;
  soporte_pago_proveedor?: string | null;
  proveedor_sin_factura: boolean;
  estado: string;
  observaciones?: string | null;
}

type ViajesProveedorListResponse = ViajeProveedorRow[] | PaginatedResponse<ViajeProveedorRow>;

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const todayInputDate = () => toDateInputValue(new Date());

const tomorrowInputDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateInputValue(date);
};

@Component({
  selector: 'app-proveedor-transporte-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    LucideCheck,
    LucideCopy,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideRotateCcw,
    LucideSearch,
    LucideTrash2,
    AutoDismissAlertDirective,
    MultiSelectFilterComponent,
    PaginationControlsComponent
  ],
  templateUrl: './proveedor-transporte-page.component.html',
  styleUrl: './proveedor-transporte-page.component.scss'
})
export class ProveedorTransportePageComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(DialogService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly formOpen = signal(false);
  readonly editingRow = signal<ViajeProveedorRow | null>(null);
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
  readonly clienteInput = signal('');
  readonly proveedorInput = signal('');
  readonly tarifaInput = signal('');
  private autoLoadTimer: ReturnType<typeof setTimeout> | null = null;

  readonly filters = this.fb.nonNullable.group({
    search: [''],
    cobrado: [''],
    pagado_proveedor: [''],
    numero_semana: [''],
    anio_semana: [new Date().getFullYear()]
  });

  readonly clienteFilterOptions = computed(() =>
    this.clientes().map((cliente) => ({
      value: cliente.id,
      label: this.clienteLabel(cliente),
      chipLabel: cliente.nombre,
      searchText: `${cliente.nombre} ${cliente.ruc_cedula}`
    }))
  );

  readonly proveedorFilterOptions = computed(() =>
    this.proveedores().map((proveedor) => ({
      value: proveedor.id,
      label: this.proveedorLabel(proveedor),
      chipLabel: proveedor.nombre,
      searchText: `${proveedor.nombre} ${proveedor.ruc_cedula}`
    }))
  );

  readonly form = this.fb.nonNullable.group({
    cliente_id: ['', Validators.required],
    proveedor_id: ['', Validators.required],
    tarifa_ruta_id: ['', Validators.required],
    fecha_salida: [todayInputDate(), Validators.required],
    fecha_llegada: [tomorrowInputDate()],
    descripcion_carga: [''],
    numeros_guia_remision: [''],
    precio_viaje: [0, [Validators.required, Validators.min(0)]],
    valor_a_facturar: [0, [Validators.required, Validators.min(0)]],
    precio_pagar_proveedor: [0, [Validators.required, Validators.min(0)]],
    viaticos: [0, [Validators.required, Validators.min(0)]],
    cobrado: [false],
    fecha_cobro: [''],
    pagado_proveedor: [false],
    fecha_pago_proveedor: [''],
    estado: ['programado', Validators.required],
    observaciones: ['']
  });

  readonly selectedRows = computed(() => {
    const ids = new Set(this.selectedIds());
    return this.rows().filter((row) => ids.has(row.id));
  });

  readonly summaryRows = computed(() => {
    const selected = this.selectedRows();
    return selected.length ? selected : this.rows();
  });

  readonly summary = computed(() => {
    const rows = this.summaryRows();
    const clientes = new Set(rows.map((row) => row.cliente?.id));
    const proveedores = new Set(rows.map((row) => row.proveedor?.id));

    return {
      viajes: rows.length,
      clientes: clientes.size,
      proveedores: proveedores.size,
      precio_viaje: rows.reduce((total, row) => total + this.number(row.precio_viaje), 0),
      valor_a_facturar: rows.reduce((total, row) => total + this.number(row.valor_a_facturar), 0),
      precio_pagar_proveedor: rows.reduce(
        (total, row) => total + this.number(row.precio_pagar_proveedor),
        0
      ),
      viaticos: rows.reduce((total, row) => total + this.number(row.viaticos), 0),
      utilidad: rows.reduce((total, row) => total + this.number(row.utilidad), 0),
      pendientes_cobro: rows.filter((row) => !row.cobrado).length,
      pendientes_pago: rows.filter((row) => !row.pagado_proveedor).length
    };
  });

  constructor() {
    const query = this.route.snapshot.queryParamMap;
    this.selectedClientIds.set(query.get('cliente_ids')?.split(',').filter(Boolean) ?? []);
    this.selectedProviderIds.set(query.get('proveedor_ids')?.split(',').filter(Boolean) ?? []);
    this.filters.patchValue(
      {
        search: query.get('search') ?? '',
        cobrado: query.get('cobrado') ?? '',
        pagado_proveedor: query.get('pagado_proveedor') ?? '',
        numero_semana: query.get('numero_semana') ?? '',
        anio_semana: Number(query.get('anio_semana')) || new Date().getFullYear()
      },
      { emitEvent: false }
    );
    this.loadCatalogs();
    this.load();
    if (query.get('new') === '1') {
      this.openCreate();
      this.applyAssistantPrefill();
    }
    this.filters.valueChanges
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.scheduleLoad();
      });
    this.form.controls.cobrado.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cobrado) => this.syncOperacionFecha(cobrado, this.form.controls.fecha_cobro));
    this.form.controls.pagado_proveedor.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((pagado) =>
        this.syncOperacionFecha(pagado, this.form.controls.fecha_pago_proveedor)
      );
    this.destroyRef.onDestroy(() => {
      if (this.autoLoadTimer) clearTimeout(this.autoLoadTimer);
    });
  }

  loadCatalogs() {
    forkJoin({
      clientes: this.api.get<ClienteOption[]>('/clientes', { activo: true, solo_propios: true }),
      proveedores: this.api.get<ProveedorOption[]>('/proveedores', {
        activo: true,
        solo_propios: true
      }),
      tarifasRuta: this.api.get<TarifaRutaOption[]>('/tarifas-ruta', {
        activa: true,
        solo_propios: true
      })
    }).subscribe({
      next: ({ clientes, proveedores, tarifasRuta }) => {
        this.clientes.set(clientes);
        this.proveedores.set(proveedores);
        this.tarifasRuta.set(tarifasRuta);
        if (this.formOpen() && this.route.snapshot.queryParamMap.get('new') === '1') {
          const cliente = clientes.find((item) => item.id === this.form.controls.cliente_id.value);
          const proveedor = proveedores.find((item) => item.id === this.form.controls.proveedor_id.value);
          const tarifa = tarifasRuta.find((item) => item.id === this.form.controls.tarifa_ruta_id.value);
          this.clienteInput.set(cliente ? this.clienteLabel(cliente) : '');
          this.proveedorInput.set(proveedor ? this.proveedorLabel(proveedor) : '');
          this.tarifaInput.set(tarifa ? this.tarifaLabel(tarifa) : '');
          this.recalculateFinancials();
        }
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron cargar los catálogos.');
      }
    });
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);

    this.api
      .get<ViajesProveedorListResponse>('/viajes-proveedor', {
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

  openCreate() {
    this.editingRow.set(null);
    this.form.reset({
      cliente_id: '',
      proveedor_id: '',
      tarifa_ruta_id: '',
      fecha_salida: todayInputDate(),
      fecha_llegada: tomorrowInputDate(),
      descripcion_carga: '',
      numeros_guia_remision: '',
      precio_viaje: 0,
      valor_a_facturar: 0,
      precio_pagar_proveedor: 0,
      viaticos: 0,
      cobrado: false,
      fecha_cobro: '',
      pagado_proveedor: false,
      fecha_pago_proveedor: '',
      estado: 'programado',
      observaciones: ''
    });
    this.clienteInput.set('');
    this.proveedorInput.set('');
    this.tarifaInput.set('');
    this.formOpen.set(true);
  }

  openEdit(row: ViajeProveedorRow) {
    this.editingRow.set(row);
    this.form.reset({
      cliente_id: row.cliente_id || row.cliente?.id || '',
      proveedor_id: row.proveedor_id || row.proveedor?.id || '',
      tarifa_ruta_id: row.tarifa_ruta_id || row.tarifa_ruta?.id || '',
      fecha_salida: this.dateInput(row.fecha_salida),
      fecha_llegada: this.dateInput(row.fecha_llegada),
      descripcion_carga: row.descripcion_carga ?? '',
      numeros_guia_remision: row.numeros_guia_remision.join(', '),
      precio_viaje: this.number(row.precio_viaje),
      valor_a_facturar: this.number(row.valor_a_facturar),
      precio_pagar_proveedor: this.number(row.precio_pagar_proveedor),
      viaticos: this.number(row.viaticos),
      cobrado: row.cobrado,
      fecha_cobro: this.dateInput(row.fecha_cobro),
      pagado_proveedor: row.pagado_proveedor,
      fecha_pago_proveedor: this.dateInput(row.fecha_pago_proveedor),
      estado: row.estado,
      observaciones: row.observaciones ?? ''
    });
    this.clienteInput.set(this.clienteLabel(row.cliente));
    this.proveedorInput.set(this.proveedorLabel(row.proveedor));
    this.tarifaInput.set(this.tarifaLabel(row.tarifa_ruta));
    this.formOpen.set(true);
  }

  openDuplicate(row: ViajeProveedorRow) {
    this.openEdit(row);
    this.editingRow.set(null);
    this.form.patchValue({
      fecha_salida: todayInputDate(),
      fecha_llegada: tomorrowInputDate(),
      cobrado: false,
      fecha_cobro: '',
      pagado_proveedor: false,
      fecha_pago_proveedor: ''
    });
  }

  closeForm() {
    this.formOpen.set(false);
    this.editingRow.set(null);
    this.saving.set(false);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) void this.router.navigateByUrl(returnUrl);
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);

    const row = this.editingRow();
    const value = this.form.getRawValue();
    const payload = {
      ...value,
      fecha_llegada: value.fecha_llegada || null,
      fecha_cobro: value.cobrado ? value.fecha_cobro || todayInputDate() : null,
      fecha_pago_proveedor: value.pagado_proveedor
        ? value.fecha_pago_proveedor || todayInputDate()
        : null,
      descripcion_carga: value.descripcion_carga || null,
      observaciones: value.observaciones || null
    };
    const request = row
      ? this.api.put<ViajeProveedorRow>(`/viajes-proveedor/${row.id}`, payload)
      : this.api.post<ViajeProveedorRow>('/viajes-proveedor', payload);

    request.subscribe({
      next: () => {
        this.message.set(row ? 'Viaje de proveedor actualizado.' : 'Viaje de proveedor creado.');
        this.closeForm();
        this.load();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo guardar el viaje de proveedor.');
        this.saving.set(false);
      }
    });
  }

  setClienteInput(value: string) {
    this.clienteInput.set(value);
    const cliente = this.findCatalogMatch(this.clientes(), value, (item) => this.clienteLabel(item));
    this.form.controls.cliente_id.setValue(cliente?.id ?? '');
    this.recalculateFinancials();
  }

  private applyAssistantPrefill() {
    const query = this.route.snapshot.queryParamMap;
    this.form.patchValue({
      cliente_id: query.get('cliente_id') ?? '',
      proveedor_id: query.get('proveedor_id') ?? '',
      tarifa_ruta_id: query.get('tarifa_ruta_id') ?? '',
      fecha_salida: query.get('fecha_salida') ?? todayInputDate(),
      fecha_llegada: query.get('fecha_llegada') ?? tomorrowInputDate(),
      numeros_guia_remision: query.get('numeros_guia_remision') ?? '',
      precio_viaje: Number(query.get('precio_viaje')) || 0,
      viaticos: Number(query.get('viaticos')) || 0
    });
  }

  setProveedorInput(value: string) {
    this.proveedorInput.set(value);
    const proveedor = this.findCatalogMatch(this.proveedores(), value, (item) => this.proveedorLabel(item));
    this.form.controls.proveedor_id.setValue(proveedor?.id ?? '');
    this.recalculateFinancials();
  }

  setTarifaInput(value: string) {
    this.tarifaInput.set(value);
    const tarifa = this.findCatalogMatch(this.tarifasRuta(), value, (item) => this.tarifaLabel(item));
    this.form.controls.tarifa_ruta_id.setValue(tarifa?.id ?? '');
    if (!tarifa) return;

    const precio = this.number(tarifa.precio);
    this.form.controls.precio_viaje.setValue(precio);
    this.recalculateFinancials();
  }

  recalculateFinancials() {
    const precioViaje = this.number(this.form.controls.precio_viaje.value);
    const cliente = this.selectedCliente();
    const proveedor = this.selectedProveedor();
    const porcentajeCliente = this.number(cliente?.porcentaje_comision ?? 0);
    const porcentajeProveedor = this.number(proveedor?.porcentaje_utilidad ?? 0);
    const valorAFacturar = precioViaje - (precioViaje * porcentajeCliente) / 100;
    const precioPagar = valorAFacturar - (valorAFacturar * porcentajeProveedor) / 100;

    this.form.controls.valor_a_facturar.setValue(Number(valorAFacturar.toFixed(2)));
    this.form.controls.precio_pagar_proveedor.setValue(Number(precioPagar.toFixed(2)));
  }

  recalculateProviderPayment() {
    const valorAFacturar = this.number(this.form.controls.valor_a_facturar.value);
    const proveedor = this.selectedProveedor();
    const porcentajeProveedor = this.number(proveedor?.porcentaje_utilidad ?? 0);
    const precioPagar = valorAFacturar - (valorAFacturar * porcentajeProveedor) / 100;

    this.form.controls.precio_pagar_proveedor.setValue(Number(precioPagar.toFixed(2)));
  }

  utilidadFormulario() {
    return (
      this.number(this.form.controls.valor_a_facturar.value) -
      this.number(this.form.controls.precio_pagar_proveedor.value) -
      this.number(this.form.controls.viaticos.value)
    );
  }

  async marcarCobrado(row: ViajeProveedorRow) {
    if (row.cobrado || row.estado === 'cancelado') return;

    const support = await this.dialog.supportPrompt({
      title: 'Marcar viaje como cobrado',
      text: `Se registrara el cobro del viaje de ${row.cliente?.nombre ?? 'este cliente'}.`,
      dateLabel: 'Fecha de cobro',
      supportLabel: 'Número de factura / soporte',
      noInvoiceLabel: 'No se emitio factura',
      confirmText: 'Marcar cobrado',
      defaultDate: todayInputDate()
    });
    if (!support) return;

    this.patchSupport(`/viajes-proveedor/${row.id}/cobro`, support, 'Viaje marcado como cobrado.');
  }

  async marcarPagado(row: ViajeProveedorRow) {
    if (row.pagado_proveedor || row.estado === 'cancelado') return;

    const support = await this.dialog.supportPrompt({
      title: 'Marcar proveedor como pagado',
      text: `Se registrara el pago a ${row.proveedor?.nombre ?? 'este proveedor'}.`,
      dateLabel: 'Fecha de pago',
      supportLabel: 'Número de factura / soporte',
      noInvoiceLabel: 'Proveedor no emitio factura',
      confirmText: 'Marcar pagado',
      defaultDate: todayInputDate()
    });
    if (!support) return;

    this.patchSupport(`/viajes-proveedor/${row.id}/pago`, support, 'Viaje marcado como pagado.');
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

    this.api.patch(`/viajes-proveedor/${row.id}/cobro`, { cobrado: false }).subscribe({
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
      rows.map((row) => `/viajes-proveedor/${row.id}/cobro`),
      support,
      `${rows.length} ${rows.length === 1 ? 'viaje marcado' : 'viajes marcados'} como cobrados.`
    );
  }

  async marcarSeleccionadosPagados() {
    const rows = this
      .selectedRows()
      .filter((row) => !row.pagado_proveedor && row.estado !== 'cancelado');
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
      rows.map((row) => `/viajes-proveedor/${row.id}/pago`),
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

    const text = this.providerPaymentText(rows);

    try {
      const image = await this.providerPaymentImage(rows);
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
        this.message.set('Imagen copiada al portapapeles.');
      } else {
        this.copyTextFallback(text);
        this.message.set('El navegador no permite copiar imagen; se copió el texto.');
      }
    } catch {
      this.copyTextFallback(text);
      this.message.set('No se pudo copiar la imagen; se copió el texto.');
    }
  }

  tripLegend(row: ViajeProveedorRow) {
    return `1 viaje a ${row.tarifa_ruta?.ruta?.destino ?? '-'} g#${row.numeros_guia_remision.join(', ') || '-'}`;
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

    this.api
      .patch(`/viajes-proveedor/${row.id}/guias`, {
        numeros_guia_remision: value
      })
      .subscribe({
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

    this.api.delete(`/viajes-proveedor/${row.id}`).subscribe({
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

  isSelected(row: ViajeProveedorRow) {
    return this.selectedIds().includes(row.id);
  }

  allVisibleSelected() {
    const rows = this.rows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  hasSelected() {
    return this.selectedIds().length > 0;
  }

  selectedCount() {
    return this.selectedIds().length;
  }

  rutaLabel(row: ViajeProveedorRow) {
    const ruta = row.tarifa_ruta?.ruta;
    return ruta ? `${ruta.origen} - ${ruta.destino}` : '-';
  }

  clienteLabel(cliente: ClienteOption) {
    return `${cliente.nombre} - ${cliente.ruc_cedula}`;
  }

  proveedorLabel(proveedor: ProveedorOption) {
    return `${proveedor.nombre} - ${proveedor.ruc_cedula}`;
  }

  tarifaLabel(tarifa: TarifaRutaOption) {
    const capacidad = tarifa.capacidad ? ` | ${tarifa.capacidad}` : '';
    return `${tarifa.ruta.origen} - ${tarifa.ruta.destino} | ${tarifa.tipo_carga.nombre}${capacidad} | $ ${this.money(tarifa.precio)}`;
  }

  estadoLabel(estado: string) {
    const labels: Record<string, string> = {
      programado: 'Programado',
      en_curso: 'En curso',
      completado: 'Completado',
      cancelado: 'Cancelado'
    };

    return labels[estado] ?? estado;
  }

  guiaPreview(row: ViajeProveedorRow) {
    const text = row.numeros_guia_remision.join(', ');
    return text.length > 20 ? `${text.slice(0, 20)}...` : text || '-';
  }

  dateOnly(value: unknown) {
    return formatDateOnly(value);
  }

  weekNumber(value: unknown) {
    const date = new Date(`${this.dateInput(value)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return '-';

    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  }

  money(value: unknown) {
    return this.number(value).toFixed(2);
  }

  number(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private syncOperacionFecha(
    active: boolean,
    control: { value: string; setValue(value: string, options?: { emitEvent?: boolean }): void }
  ) {
    if (active && !control.value) {
      control.setValue(todayInputDate(), { emitEvent: false });
      return;
    }

    if (!active && control.value) {
      control.setValue('', { emitEvent: false });
    }
  }

  private dateInput(value: unknown) {
    const text = String(value ?? '');
    return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
  }

  private selectedCliente() {
    const id = this.form.controls.cliente_id.value;
    return this.clientes().find((cliente) => cliente.id === id) ?? null;
  }

  private selectedProveedor() {
    const id = this.form.controls.proveedor_id.value;
    return this.proveedores().find((proveedor) => proveedor.id === id) ?? null;
  }

  private findCatalogMatch<T>(items: T[], value: string, label: (item: T) => string) {
    const normalized = value.trim().toLowerCase();
    return items.find((item) => label(item).toLowerCase() === normalized) ?? null;
  }

  private scheduleLoad() {
    if (this.autoLoadTimer) {
      clearTimeout(this.autoLoadTimer);
    }

    this.autoLoadTimer = setTimeout(() => this.load(), 350);
  }

  private patchSupport(path: string, support: SupportPromptResult, successMessage: string) {
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);

    this.api.patch(path, support).subscribe({
      next: () => {
        this.message.set(successMessage);
        this.load();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo procesar la acción.');
        this.loading.set(false);
      }
    });
  }

  private bulkPatch(paths: string[], support: SupportPromptResult, successMessage: string) {
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);

    forkJoin(paths.map((path) => this.api.patch(path, support))).subscribe({
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

  private providerPaymentText(rows: ViajeProveedorRow[]) {
    const first = rows[0]!;
    const subtotal = rows.reduce((total, row) => total + this.number(row.precio_pagar_proveedor), 0);
    const porcentaje = this.number(first.proveedor.porcentaje_utilidad);
    const porcentajeValor = subtotal * (porcentaje / 100);
    const total = subtotal - porcentajeValor;
    const fechaActual = todayInputDate();
    const detail = rows
      .map((row) =>
        [
          this.weekNumber(row.fecha_salida),
          this.rutaLabel(row),
          row.descripcion_carga || '-',
          row.numeros_guia_remision.join(', ') || '-',
          `$ ${this.money(row.precio_pagar_proveedor)}`
        ].join(' | ')
      )
      .join('\n');

    return [
      `${first.proveedor.nombre}     ${fechaActual}`,
      'SEM | RUTA | DETALLE | GUIA | PRECIO A PAGAR',
      detail,
      `SUBTOTAL: $ ${this.money(subtotal)}`,
      `porcentaje(${this.money(porcentaje)}%): $ ${this.money(porcentajeValor)}`,
      `TOTAL: $ ${this.money(total)}`
    ].join('\n');
  }

  private async providerPaymentImage(rows: ViajeProveedorRow[]) {
    const first = rows[0]!;
    const subtotal = rows.reduce((total, row) => total + this.number(row.precio_pagar_proveedor), 0);
    const porcentaje = this.number(first.proveedor.porcentaje_utilidad);
    const porcentajeValor = subtotal * (porcentaje / 100);
    const total = subtotal - porcentajeValor;
    const fechaActual = todayInputDate();
    const width = 1200;
    const padding = 28;
    const lineHeight = 22;
    const columns = {
      sem: 58,
      ruta: 300,
      detalle: 270,
      guia: 320,
      precio: 160
    };
    const bodyFont = '16px Arial, sans-serif';
    const headerFont = '700 16px Arial, sans-serif';
    const titleFont = '800 26px Arial, sans-serif';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo generar la imagen.');

    const wrap = (text: string, maxWidth: number, font = bodyFont) => {
      ctx.font = font;
      const words = String(text || '-').split(/\s+/);
      const lines: string[] = [];
      let current = '';

      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (ctx.measureText(next).width <= maxWidth || !current) {
          current = next;
        } else {
          lines.push(current);
          current = word;
        }
      }

      if (current) lines.push(current);
      return lines;
    };

    const preparedRows = rows.map((row) => {
      const rutaLines = wrap(this.rutaLabel(row), columns.ruta - 16);
      const detalleLines = wrap(row.descripcion_carga || '-', columns.detalle - 16);
      const guiaLines = wrap(row.numeros_guia_remision.join(', ') || '-', columns.guia - 16);
      return {
        sem: String(this.weekNumber(row.fecha_salida)),
        rutaLines,
        detalleLines,
        guiaLines,
        precio: `$ ${this.money(row.precio_pagar_proveedor)}`,
        height: Math.max(rutaLines.length, detalleLines.length, guiaLines.length, 1) * lineHeight + 18
      };
    });
    const tableHeight = 38 + preparedRows.reduce((height, row) => height + row.height, 0);
    const summaryHeight = 112;
    const height = padding * 2 + 42 + 18 + tableHeight + summaryHeight;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#0f172a';
    ctx.font = titleFont;
    ctx.fillText(first.proveedor.nombre.toUpperCase(), padding, padding + 26);
    ctx.font = headerFont;
    const dateText = fechaActual;
    ctx.fillText(dateText, width - padding - ctx.measureText(dateText).width, padding + 26);

    let y = padding + 62;
    const xSem = padding;
    const xRuta = xSem + columns.sem;
    const xDetalle = xRuta + columns.ruta;
    const xGuia = xDetalle + columns.detalle;
    const xPrecio = xGuia + columns.guia;

    ctx.fillStyle = '#e2f3fb';
    ctx.fillRect(padding - 10, y - 24, width - padding * 2 + 20, 36);
    ctx.fillStyle = '#0f172a';
    ctx.font = headerFont;
    ctx.fillText('SEM', xSem, y);
    ctx.fillText('RUTA', xRuta, y);
    ctx.fillText('DETALLE', xDetalle, y);
    ctx.fillText('GUIA', xGuia, y);
    ctx.fillText('PRECIO A PAGAR', xPrecio, y);
    y += 24;

    ctx.font = bodyFont;
    for (const row of preparedRows) {
      ctx.strokeStyle = '#d9e2ec';
      ctx.beginPath();
      ctx.moveTo(padding - 10, y - 12);
      ctx.lineTo(width - padding + 10, y - 12);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.fillText(row.sem, xSem, y + 6);
      row.rutaLines.forEach((line, index) => ctx.fillText(line, xRuta, y + 6 + index * lineHeight));
      row.detalleLines.forEach((line, index) =>
        ctx.fillText(line, xDetalle, y + 6 + index * lineHeight)
      );
      row.guiaLines.forEach((line, index) => ctx.fillText(line, xGuia, y + 6 + index * lineHeight));
      ctx.fillText(row.precio, xPrecio, y + 6);
      y += row.height;
    }

    y += 18;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(padding - 10, y - 18, width - padding * 2 + 20, summaryHeight - 10);
    ctx.font = headerFont;
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`SUBTOTAL: $ ${this.money(subtotal)}`, padding, y + 10);
    ctx.fillText(`porcentaje(${this.money(porcentaje)}%): $ ${this.money(porcentajeValor)}`, padding, y + 42);
    ctx.fillStyle = '#065f46';
    ctx.font = '800 22px Arial, sans-serif';
    ctx.fillText(`TOTAL: $ ${this.money(total)}`, padding, y + 78);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.'))), 'image/png');
    });
  }

  private copyTextFallback(text: string) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}
