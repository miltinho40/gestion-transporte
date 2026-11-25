import {
  Component,
  DestroyRef,
  OnChanges,
  OnInit,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { FacturarAFieldComponent } from '../../shared/facturar-a-field.component';
import { ProveedorTransporteApiService } from './proveedor-transporte-api.service';
import type {
  ClienteOption,
  ProveedorOption,
  ProveedorEditorRequest,
  TarifaRutaOption,
  ViajeProveedorRow
} from './proveedor-transporte.models';
import {
  clienteLabel,
  dateInput,
  findCatalogMatch,
  money,
  number,
  providerFinancials,
  proveedorLabel,
  tarifaLabel,
  todayInputDate,
  tomorrowInputDate
} from './proveedor-transporte.helpers';

@Component({
  selector: 'app-proveedor-viaje-editor-modal',
  imports: [FormsModule, ReactiveFormsModule, AutoDismissAlertDirective, FacturarAFieldComponent],
  templateUrl: './proveedor-viaje-editor-modal.component.html',
  styleUrl: './proveedor-viaje-editor-modal.component.scss'
})
export class ProveedorViajeEditorModalComponent implements OnInit, OnChanges {
  private readonly api = inject(ProveedorTransporteApiService);
  readonly request = input.required<ProveedorEditorRequest>();
  readonly clientes = input<ClienteOption[]>([]);
  readonly proveedores = input<ProveedorOption[]>([]);
  readonly tarifasRuta = input<TarifaRutaOption[]>([]);
  readonly catalogError = input<string | null>(null);
  readonly closed = output<void>();
  readonly saved = output<string>();
  readonly clienteLabel = clienteLabel;
  readonly proveedorLabel = proveedorLabel;
  readonly tarifaLabel = tarifaLabel;
  readonly money = money;
  readonly number = number;
  readonly dateInput = dateInput;
  readonly findCatalogMatch = findCatalogMatch;
  private initialized = false;
  private readonly fb = inject(FormBuilder);

  private readonly destroyRef = inject(DestroyRef);

  readonly error = signal<string | null>(null);

  readonly saving = signal(false);

  readonly formOpen = signal(false);

  readonly editingRow = signal<ViajeProveedorRow | null>(null);

  readonly clienteInput = signal('');

  readonly proveedorInput = signal('');

  readonly tarifaInput = signal('');

  readonly form = this.fb.nonNullable.group({
    cliente_id: ['', Validators.required],
    facturar_a_id: [''],
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
      facturar_a_id: row.facturar_a_id ?? '',
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

  setClienteInput(value: string) {
    this.clienteInput.set(value);
    const cliente = this.findCatalogMatch(this.clientes(), value, (item) =>
      this.clienteLabel(item)
    );
    this.form.controls.cliente_id.setValue(cliente?.id ?? '');
    this.recalculateFinancials();
  }

  setProveedorInput(value: string) {
    this.proveedorInput.set(value);
    const proveedor = this.findCatalogMatch(this.proveedores(), value, (item) =>
      this.proveedorLabel(item)
    );
    this.form.controls.proveedor_id.setValue(proveedor?.id ?? '');
    this.recalculateFinancials();
  }

  setTarifaInput(value: string) {
    this.tarifaInput.set(value);
    const tarifa = this.findCatalogMatch(this.tarifasRuta(), value, (item) =>
      this.tarifaLabel(item)
    );
    this.form.controls.tarifa_ruta_id.setValue(tarifa?.id ?? '');
    if (!tarifa) return;

    const precio = this.number(tarifa.precio);
    this.form.controls.precio_viaje.setValue(precio);
    this.recalculateFinancials();
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

  private selectedCliente() {
    const id = this.form.controls.cliente_id.value;
    return this.clientes().find((cliente) => cliente.id === id) ?? null;
  }

  private selectedProveedor() {
    const id = this.form.controls.proveedor_id.value;
    return this.proveedores().find((proveedor) => proveedor.id === id) ?? null;
  }
  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const row = this.editingRow();
    const value = this.form.getRawValue();
    const {
      estado: _estado,
      cobrado: _cobrado,
      fecha_cobro: _fechaCobro,
      valor_a_facturar: _facturar,
      ...operativos
    } = value;
    const payload = {
      ...operativos,
      facturar_a_id: value.facturar_a_id || null,
      fecha_llegada: value.fecha_llegada || null,
      fecha_pago_proveedor: value.pagado_proveedor
        ? value.fecha_pago_proveedor || todayInputDate()
        : null,
      descripcion_carga: value.descripcion_carga || null,
      observaciones: value.observaciones || null
    };
    const request = this.api.save(payload, row?.id);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saved.emit(row ? 'Viaje de proveedor actualizado.' : 'Viaje de proveedor creado.');
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo guardar el viaje de proveedor.');
        this.saving.set(false);
      }
    });
  }
  private applyAssistantPrefill() {
    const query = { get: (key: string) => this.request().prefill?.[key] ?? null };
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
  constructor() {
    this.form.controls.cobrado.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((active) => this.syncOperacionFecha(active, this.form.controls.fecha_cobro));
    this.form.controls.pagado_proveedor.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((active) =>
        this.syncOperacionFecha(active, this.form.controls.fecha_pago_proveedor)
      );
  }
  ngOnInit() {
    const request = this.request();
    if (request.row && request.mode === 'edit') this.openEdit(request.row);
    else if (request.row && request.mode === 'duplicate') this.openDuplicate(request.row);
    else this.openCreate();
    if (request.prefill) {
      this.applyAssistantPrefill();
      this.syncPrefillCatalogs();
    }
    this.initialized = true;
  }
  ngOnChanges() {
    if (this.initialized && this.request().prefill) this.syncPrefillCatalogs();
  }
  closeForm() {
    this.closed.emit();
  }
  private syncPrefillCatalogs() {
    const cliente = this.selectedCliente(),
      proveedor = this.selectedProveedor();
    const tarifa = this.tarifasRuta().find(
      (item) => item.id === this.form.controls.tarifa_ruta_id.value
    );
    this.clienteInput.set(cliente ? this.clienteLabel(cliente) : '');
    this.proveedorInput.set(proveedor ? this.proveedorLabel(proveedor) : '');
    this.tarifaInput.set(tarifa ? this.tarifaLabel(tarifa) : '');
    this.recalculateFinancials();
  }
  recalculateFinancials() {
    const values = providerFinancials(
      this.form.controls.precio_viaje.value,
      this.selectedCliente()?.porcentaje_comision,
      this.selectedProveedor()?.porcentaje_utilidad
    );
    this.form.controls.valor_a_facturar.setValue(values.valor_a_facturar);
    this.form.controls.precio_pagar_proveedor.setValue(values.precio_pagar_proveedor);
  }
}
