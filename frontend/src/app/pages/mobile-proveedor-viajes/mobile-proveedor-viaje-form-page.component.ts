import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideArrowLeft, LucideSave } from '@lucide/angular';
import { Subscription, forkJoin, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import {
  ClienteOption,
  EstadoViajeProveedor,
  ProveedorOption,
  ProveedorViajeCatalogField,
  SelectOption,
  TarifaRutaOption,
  ViajeProveedorRow,
  addDaysInputDate,
  dateInputValue,
  numberValue,
  roundMoney,
  splitGuiasRemision,
  todayInputDate
} from './mobile-proveedor-viajes.types';

@Component({
  selector: 'app-mobile-proveedor-viaje-form-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    LucideArrowLeft,
    LucideSave,
    AutoDismissAlertDirective
  ],
  templateUrl: './mobile-proveedor-viaje-form-page.component.html',
  styleUrl: './mobile-proveedor-viaje-form-page.component.scss'
})
export class MobileProveedorViajeFormPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sub = new Subscription();

  readonly viajeId = this.route.snapshot.paramMap.get('id');
  readonly duplicateFromId = this.route.snapshot.queryParamMap.get('duplicateFrom');
  readonly editing = Boolean(this.viajeId);
  readonly duplicating = !this.editing && Boolean(this.duplicateFromId);
  readonly clientes = signal<ClienteOption[]>([]);
  readonly proveedores = signal<ProveedorOption[]>([]);
  readonly tarifasRuta = signal<TarifaRutaOption[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly catalogInput = signal<Record<ProveedorViajeCatalogField, string>>({
    cliente_id: '',
    proveedor_id: '',
    tarifa_ruta_id: ''
  });

  readonly form = this.fb.nonNullable.group({
    cliente_id: ['', Validators.required],
    proveedor_id: ['', Validators.required],
    tarifa_ruta_id: ['', Validators.required],
    fecha_salida: [todayInputDate(), Validators.required],
    fecha_llegada: [addDaysInputDate(todayInputDate(), 1)],
    descripcion_carga: [''],
    numeros_guia_remision: [''],
    precio_viaje: [0, [Validators.required, Validators.min(0)]],
    valor_a_facturar: [0, [Validators.required, Validators.min(0)]],
    precio_pagar_proveedor: [0, [Validators.required, Validators.min(0)]],
    viaticos: [0, [Validators.min(0)]],
    cobrado: [false],
    fecha_cobro: [''],
    pagado_proveedor: [false],
    fecha_pago_proveedor: [''],
    estado: ['programado' as EstadoViajeProveedor],
    observaciones: ['']
  });

  constructor() {
    this.sub.add(
      this.form.controls.cobrado.valueChanges.subscribe((cobrado) => {
        this.syncOperacionFecha(cobrado, this.form.controls.fecha_cobro);
      })
    );
    this.sub.add(
      this.form.controls.pagado_proveedor.valueChanges.subscribe((pagado) => {
        this.syncOperacionFecha(pagado, this.form.controls.fecha_pago_proveedor);
      })
    );
    this.load();
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    const sourceId = this.viajeId ?? this.duplicateFromId;

    this.sub.add(
      forkJoin({
        clientes: this.api.get<ClienteOption[]>('/clientes', {
          activo: true,
          solo_propios: true
        }),
        proveedores: this.api.get<ProveedorOption[]>('/proveedores', {
          activo: true,
          solo_propios: true
        }),
        tarifasRuta: this.api.get<TarifaRutaOption[]>('/tarifas-ruta', {
          activa: true,
          solo_propios: true
        }),
        viaje: sourceId ? this.api.get<ViajeProveedorRow>(`/viajes-proveedor/${sourceId}`) : of(null)
      }).subscribe({
        next: ({ clientes, proveedores, tarifasRuta, viaje }) => {
          this.clientes.set(clientes);
          this.proveedores.set(proveedores);
          this.tarifasRuta.set(tarifasRuta);

          if (viaje) {
            this.fillForm(viaje, { duplicate: this.duplicating });
          } else {
            this.syncCatalogInputs();
          }

          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudo cargar el formulario.');
          this.loading.set(false);
        }
      })
    );
  }

  goBack() {
    void this.router.navigate(['/movil/viajes-proveedores']);
  }

  setCatalogInput(field: ProveedorViajeCatalogField, value: string) {
    this.catalogInput.update((current) => ({ ...current, [field]: value }));
    const match = this.catalogOptions(field).find((option) => option.label.toLowerCase() === value.trim().toLowerCase());
    this.form.controls[field].setValue(match?.value ?? '');

    if (!match) return;

    if (field === 'tarifa_ruta_id') {
      const tarifa = this.tarifasRuta().find((item) => item.id === match.value);
      this.form.controls.precio_viaje.setValue(numberValue(tarifa?.precio), { emitEvent: false });
    }

    this.recalculateFinancials();
  }

  catalogInputValue(field: ProveedorViajeCatalogField) {
    return this.catalogInput()[field] ?? '';
  }

  catalogOptions(field: ProveedorViajeCatalogField): SelectOption[] {
    if (field === 'cliente_id') {
      return this.clientes().map((cliente) => ({
        value: cliente.id,
        label: `${cliente.nombre} - ${cliente.ruc_cedula}`
      }));
    }

    if (field === 'proveedor_id') {
      return this.proveedores().map((proveedor) => ({
        value: proveedor.id,
        label: `${proveedor.nombre} - ${proveedor.ruc_cedula}`
      }));
    }

    return this.tarifasRuta().map((tarifa) => ({
      value: tarifa.id,
      label: this.tarifaLabel(tarifa)
    }));
  }

  onFechaSalidaChange() {
    if (!this.editing) {
      this.form.controls.fecha_llegada.setValue(addDaysInputDate(this.form.controls.fecha_salida.value, 1));
    }
  }

  onPrecioViajeChanged() {
    this.recalculateFinancials();
  }

  onValorFacturarChanged() {
    this.recalculateProviderPayment();
  }

  recalculateFinancials() {
    const precioViaje = numberValue(this.form.controls.precio_viaje.value);
    const cliente = this.selectedCliente();
    const proveedor = this.selectedProveedor();
    const porcentajeCliente = numberValue(cliente?.porcentaje_comision);
    const porcentajeProveedor = numberValue(proveedor?.porcentaje_utilidad);
    const valorAFacturar = precioViaje - (precioViaje * porcentajeCliente) / 100;
    const precioPagar = valorAFacturar - (valorAFacturar * porcentajeProveedor) / 100;

    this.form.controls.valor_a_facturar.setValue(roundMoney(valorAFacturar), { emitEvent: false });
    this.form.controls.precio_pagar_proveedor.setValue(roundMoney(precioPagar), { emitEvent: false });
  }

  recalculateProviderPayment() {
    const valorAFacturar = numberValue(this.form.controls.valor_a_facturar.value);
    const proveedor = this.selectedProveedor();
    const porcentajeProveedor = numberValue(proveedor?.porcentaje_utilidad);
    const precioPagar = valorAFacturar - (valorAFacturar * porcentajeProveedor) / 100;

    this.form.controls.precio_pagar_proveedor.setValue(roundMoney(precioPagar), { emitEvent: false });
  }

  utilidadFormulario() {
    return roundMoney(
      numberValue(this.form.controls.valor_a_facturar.value) -
        numberValue(this.form.controls.precio_pagar_proveedor.value) -
        numberValue(this.form.controls.viaticos.value)
    );
  }

  save() {
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios.');
      return;
    }

    const payload = this.buildPayload();
    const request = this.viajeId
      ? this.api.put<ViajeProveedorRow>(`/viajes-proveedor/${this.viajeId}`, payload)
      : this.api.post<ViajeProveedorRow>('/viajes-proveedor', payload);

    this.saving.set(true);
    this.sub.add(
      request.subscribe({
        next: () => {
          this.saving.set(false);
          void this.router.navigate(['/movil/viajes-proveedores']);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo guardar el viaje de proveedor.');
        }
      })
    );
  }

  money(value: unknown) {
    return numberValue(value).toFixed(2);
  }

  private fillForm(row: ViajeProveedorRow, options: { duplicate?: boolean } = {}) {
    this.form.reset({
      cliente_id: String(row.cliente_id || row.cliente?.id),
      proveedor_id: String(row.proveedor_id || row.proveedor?.id),
      tarifa_ruta_id: String(row.tarifa_ruta_id || row.tarifa_ruta?.id),
      fecha_salida: options.duplicate ? todayInputDate() : dateInputValue(row.fecha_salida),
      fecha_llegada: options.duplicate ? addDaysInputDate(todayInputDate(), 1) : dateInputValue(row.fecha_llegada),
      descripcion_carga: row.descripcion_carga ?? '',
      numeros_guia_remision: (row.numeros_guia_remision ?? []).join(', '),
      precio_viaje: numberValue(row.precio_viaje),
      valor_a_facturar: numberValue(row.valor_a_facturar),
      precio_pagar_proveedor: numberValue(row.precio_pagar_proveedor),
      viaticos: numberValue(row.viaticos),
      cobrado: options.duplicate ? false : Boolean(row.cobrado),
      fecha_cobro: options.duplicate ? '' : dateInputValue(row.fecha_cobro),
      pagado_proveedor: options.duplicate ? false : Boolean(row.pagado_proveedor),
      fecha_pago_proveedor: options.duplicate ? '' : dateInputValue(row.fecha_pago_proveedor),
      estado: options.duplicate ? 'programado' : row.estado,
      observaciones: row.observaciones ?? ''
    });
    this.syncCatalogInputs();
  }

  private buildPayload() {
    const value = this.form.getRawValue();

    return {
      cliente_id: value.cliente_id,
      proveedor_id: value.proveedor_id,
      tarifa_ruta_id: value.tarifa_ruta_id,
      fecha_salida: value.fecha_salida,
      fecha_llegada: value.fecha_llegada || null,
      descripcion_carga: value.descripcion_carga || null,
      numeros_guia_remision: splitGuiasRemision(value.numeros_guia_remision),
      precio_viaje: numberValue(value.precio_viaje),
      valor_a_facturar: numberValue(value.valor_a_facturar),
      precio_pagar_proveedor: numberValue(value.precio_pagar_proveedor),
      viaticos: numberValue(value.viaticos),
      cobrado: value.cobrado,
      fecha_cobro: value.cobrado ? value.fecha_cobro || todayInputDate() : null,
      pagado_proveedor: value.pagado_proveedor,
      fecha_pago_proveedor: value.pagado_proveedor ? value.fecha_pago_proveedor || todayInputDate() : null,
      estado: value.estado,
      observaciones: value.observaciones || null
    };
  }

  private syncCatalogInputs() {
    (['cliente_id', 'proveedor_id', 'tarifa_ruta_id'] as ProveedorViajeCatalogField[]).forEach((field) => {
      const value = this.form.controls[field].value;
      const option = this.catalogOptions(field).find((item) => String(item.value) === String(value));
      this.catalogInput.update((current) => ({ ...current, [field]: option?.label ?? '' }));
    });
  }

  private selectedCliente() {
    const id = this.form.controls.cliente_id.value;
    return this.clientes().find((cliente) => cliente.id === id) ?? null;
  }

  private selectedProveedor() {
    const id = this.form.controls.proveedor_id.value;
    return this.proveedores().find((proveedor) => proveedor.id === id) ?? null;
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

  private tarifaLabel(tarifa: TarifaRutaOption) {
    const capacidad = tarifa.capacidad ? `, ${tarifa.capacidad}` : '';
    return `${tarifa.ruta.origen} - ${tarifa.ruta.destino} / ${tarifa.tipo_carga.nombre}${capacidad} / $ ${this.money(tarifa.precio)}`;
  }
}
