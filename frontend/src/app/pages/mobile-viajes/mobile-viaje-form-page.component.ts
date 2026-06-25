import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideArrowLeft, LucideCalculator, LucidePlus, LucideSave, LucideTrash2 } from '@lucide/angular';
import { Subscription, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import {
  CalculoViaje,
  ClienteOption,
  ConductorOption,
  EstadoViaje,
  GastoViajeItem,
  SelectOption,
  TarifaRutaOption,
  TipoGastoOption,
  VehiculoOption,
  ViajeCatalogField,
  ViajeRow,
  addDaysInputDate,
  dateInputValue,
  numberValue,
  roundMoney,
  splitGuiasRemision,
  todayInputDate
} from './mobile-viajes.types';

@Component({
  selector: 'app-mobile-viaje-form-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    LucideArrowLeft,
    LucideCalculator,
    LucidePlus,
    LucideSave,
    LucideTrash2,
    AutoDismissAlertDirective
  ],
  templateUrl: './mobile-viaje-form-page.component.html',
  styleUrl: './mobile-viaje-form-page.component.scss'
})
export class MobileViajeFormPageComponent implements OnDestroy {
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
  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly conductores = signal<ConductorOption[]>([]);
  readonly tarifasRuta = signal<TarifaRutaOption[]>([]);
  readonly tiposGasto = signal<TipoGastoOption[]>([]);
  readonly gastos = signal<GastoViajeItem[]>([]);
  readonly deletedGastoIds = signal<string[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly calculating = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly catalogInput = signal<Record<ViajeCatalogField, string>>({
    cliente_id: '',
    vehiculo_id: '',
    conductor_id: '',
    tarifa_ruta_id: '',
    tipo_gasto_id: ''
  });

  private precioRealManual = false;
  private viaticosManual = false;

  readonly form = this.fb.nonNullable.group({
    cliente_id: ['', Validators.required],
    vehiculo_id: ['', Validators.required],
    conductor_id: ['', Validators.required],
    tarifa_ruta_id: ['', Validators.required],
    fecha_salida: [todayInputDate(), Validators.required],
    fecha_llegada: [addDaysInputDate(todayInputDate(), 1)],
    descripcion_carga: [''],
    numeros_guia_remision: [''],
    precio_flete: [0, [Validators.required, Validators.min(0.01)]],
    precio_real_flete: [0, [Validators.min(0)]],
    galones_diesel: [0],
    costo_diesel: [0],
    costo_peajes: [0],
    costo_estimado_gastos: [0],
    viaticos: [0, [Validators.min(0)]],
    cobrado: [false],
    retorno: [false],
    fecha_cobro: [''],
    estado: ['programado' as EstadoViaje, Validators.required],
    observaciones: ['']
  });

  readonly gastoForm = this.fb.nonNullable.group({
    tipo_gasto_id: [''],
    monto: [0, [Validators.min(0.01)]],
    descripcion: ['']
  });

  constructor() {
    this.sub.add(
      this.form.controls.cobrado.valueChanges.subscribe((cobrado) => {
        if (cobrado && !this.form.controls.fecha_cobro.value) {
          this.form.controls.fecha_cobro.setValue(todayInputDate(), { emitEvent: false });
        }

        if (!cobrado) {
          this.form.controls.fecha_cobro.setValue('', { emitEvent: false });
        }
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

    const baseRequests = {
      clientes: this.api.get<ClienteOption[]>('/clientes', { activo: true }),
      vehiculos: this.api.get<VehiculoOption[]>('/vehiculos'),
      conductores: this.api.get<ConductorOption[]>('/conductores', { estado: 'activo' }),
      tarifasRuta: this.api.get<TarifaRutaOption[]>('/tarifas-ruta', { activa: true }),
      tiposGasto: this.api.get<TipoGastoOption[]>('/tipos-gasto-viaje', { activo: true })
    };
    const sourceViajeId = this.viajeId ?? this.duplicateFromId;

    this.sub.add(
      forkJoin({
        ...baseRequests,
        viaje: sourceViajeId ? this.api.get<ViajeRow>(`/viajes/${sourceViajeId}`) : of(null),
        gastos: sourceViajeId ? this.api.get<any[]>(`/viajes/${sourceViajeId}/gastos`) : of([])
      }).subscribe({
        next: ({ clientes, vehiculos, conductores, tarifasRuta, tiposGasto, viaje, gastos }) => {
          this.clientes.set(clientes);
          this.vehiculos.set(vehiculos);
          this.conductores.set(conductores);
          this.tarifasRuta.set(tarifasRuta);
          this.tiposGasto.set(tiposGasto);
          this.deletedGastoIds.set([]);

          if (viaje) {
            this.fillForm(viaje, { duplicate: this.duplicating });
            this.setGastos(gastos, { duplicate: this.duplicating });
          } else {
            this.gastos.set([]);
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
    const returnUrl = this.returnUrl();
    if (returnUrl) {
      void this.router.navigateByUrl(returnUrl);
      return;
    }
    void this.router.navigate(['/movil/viajes']);
  }

  setCatalogInput(field: ViajeCatalogField, value: string) {
    this.catalogInput.update((current) => ({ ...current, [field]: value }));
    const match = this.catalogOptions(field).find((option) => option.label.toLowerCase() === value.trim().toLowerCase());
    if (field === 'tipo_gasto_id') {
      this.gastoForm.controls.tipo_gasto_id.setValue(match?.value ?? '');
      return;
    }

    this.form.controls[field].setValue(match?.value ?? '');

    if (!match) return;

    if (field === 'tarifa_ruta_id') {
      this.onTarifaChange();
      return;
    }

    if (field === 'cliente_id' || field === 'vehiculo_id') {
      this.fetchCalculation({ resetPrecioReal: true, resetViaticos: !this.editing });
    }
  }

  catalogInputValue(field: ViajeCatalogField) {
    return this.catalogInput()[field] ?? '';
  }

  catalogOptions(field: ViajeCatalogField): SelectOption[] {
    if (field === 'cliente_id') {
      return this.clientes().map((cliente) => ({
        value: cliente.id,
        label: `${cliente.nombre} - ${cliente.ruc_cedula}`
      }));
    }

    if (field === 'vehiculo_id') {
      return this.vehiculos().map((vehiculo) => ({
        value: vehiculo.id,
        label: `${vehiculo.placa} - ${vehiculo.marca}`
      }));
    }

    if (field === 'conductor_id') {
      return this.conductores().map((conductor) => ({
        value: conductor.id,
        label: `${conductor.nombre} - ${conductor.cedula}`
      }));
    }

    if (field === 'tarifa_ruta_id') {
      return this.tarifasRuta().map((tarifa) => ({
        value: tarifa.id,
        label: this.tarifaLabel(tarifa)
      }));
    }

    return this.tiposGasto().map((tipo) => ({
      value: tipo.id,
      label: tipo.nombre
    }));
  }

  onFechaSalidaChange() {
    if (!this.editing) {
      this.form.controls.fecha_llegada.setValue(addDaysInputDate(this.form.controls.fecha_salida.value, 1));
    }

    this.fetchCalculation({ resetPrecioReal: true, resetViaticos: !this.editing });
  }

  onTarifaChange() {
    this.form.controls.precio_flete.setValue(0);
    this.fetchCalculation({
      forcePrecioFlete: true,
      resetPrecioReal: true,
      resetViaticos: !this.editing
    });
  }

  onPrecioFleteChanged() {
    this.fetchCalculation({ resetPrecioReal: true, resetViaticos: !this.editing });
  }

  onPrecioRealChanged() {
    this.precioRealManual = true;
  }

  onViaticosChanged() {
    this.viaticosManual = true;
  }

  fetchCalculation(
    options: { forcePrecioFlete?: boolean; resetPrecioReal?: boolean; resetViaticos?: boolean } = {}
  ) {
    const value = this.form.getRawValue();
    if (!value.cliente_id || !value.vehiculo_id || !value.tarifa_ruta_id) return;

    if (options.resetPrecioReal) this.precioRealManual = false;
    if (options.resetViaticos) this.viaticosManual = false;

    this.calculating.set(true);
    this.sub.add(
      this.api
        .get<CalculoViaje>('/viajes/calculo', {
          cliente_id: value.cliente_id,
          vehiculo_id: value.vehiculo_id,
          tarifa_ruta_id: value.tarifa_ruta_id,
          fecha_salida: value.fecha_salida,
          precio_flete:
            !options.forcePrecioFlete && numberValue(value.precio_flete) > 0
              ? numberValue(value.precio_flete)
              : undefined
        })
        .subscribe({
          next: (calculo) => {
            this.applyCalculation(calculo, options.forcePrecioFlete === true);
            this.calculating.set(false);
          },
          error: (err) => {
            this.error.set(err?.error?.message ?? 'No se pudieron calcular los valores.');
            this.calculating.set(false);
          }
        })
    );
  }

  save() {
    this.message.set(null);
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios.');
      return;
    }

    const payload = this.buildPayload();
    const request = this.viajeId
      ? this.api.put<ViajeRow>(`/viajes/${this.viajeId}`, payload)
      : this.api.post<ViajeRow>('/viajes', payload);

    this.saving.set(true);
    this.sub.add(
      request
        .pipe(
          switchMap((viaje) =>
            this.syncGastos(viaje.id).pipe(
              map(() => viaje)
            )
          )
        )
        .subscribe({
        next: () => {
          this.saving.set(false);
          const returnUrl = this.returnUrl();
          if (returnUrl) {
            void this.router.navigateByUrl(returnUrl);
            return;
          }
          void this.router.navigate(['/movil/viajes']);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo guardar el viaje.');
        }
      })
    );
  }

  money(value: unknown) {
    return numberValue(value).toFixed(2);
  }

  addGasto() {
    const value = this.gastoForm.getRawValue();
    const tipo = this.tiposGasto().find((item) => String(item.id) === String(value.tipo_gasto_id));
    if (!tipo || numberValue(value.monto) <= 0) {
      this.gastoForm.markAllAsTouched();
      this.error.set('Selecciona el tipo de gasto e ingresa un monto.');
      return;
    }

    this.gastos.update((current) => [
      ...current,
      {
        tipo_gasto_id: tipo.id,
        tipo_gasto_nombre: tipo.nombre,
        descripcion: value.descripcion || null,
        monto: roundMoney(numberValue(value.monto)),
        es_estimado: false
      }
    ]);
    this.resetGastoForm();
    this.error.set(null);
  }

  removeGasto(index: number) {
    const gasto = this.gastos()[index];
    if (gasto?.id) {
      this.deletedGastoIds.update((current) => [...current, gasto.id!]);
    }

    this.gastos.update((current) => current.filter((_item, itemIndex) => itemIndex !== index));
  }

  resetGastoForm() {
    this.gastoForm.reset({
      tipo_gasto_id: '',
      monto: 0,
      descripcion: ''
    });
    this.catalogInput.update((current) => ({ ...current, tipo_gasto_id: '' }));
  }

  totalGastosAdicionales() {
    return roundMoney(
      this.gastos()
        .filter((item) => !item.es_estimado)
        .reduce((total, item) => total + numberValue(item.monto), 0)
    );
  }

  totalGastosReales() {
    return roundMoney(numberValue(this.form.controls.viaticos.value) + this.totalGastosAdicionales());
  }

  utilidadViaje() {
    return roundMoney(numberValue(this.form.controls.precio_real_flete.value) - this.totalGastosReales());
  }

  private fillForm(row: ViajeRow, options: { duplicate?: boolean } = {}) {
    this.form.reset({
      cliente_id: String(row.cliente_id),
      vehiculo_id: String(row.vehiculo_id),
      conductor_id: String(row.conductor_id),
      tarifa_ruta_id: String(row.tarifa_ruta_id),
      fecha_salida: dateInputValue(row.fecha_salida),
      fecha_llegada: dateInputValue(row.fecha_llegada),
      descripcion_carga: row.descripcion_carga ?? '',
      numeros_guia_remision: (row.numeros_guia_remision ?? []).join(', '),
      precio_flete: numberValue(row.precio_flete),
      precio_real_flete: numberValue(row.precio_real_flete),
      galones_diesel: numberValue(row.galones_diesel),
      costo_diesel: numberValue(row.costo_diesel),
      costo_peajes: numberValue(row.costo_peajes),
      costo_estimado_gastos: numberValue(row.costo_estimado_gastos),
      viaticos: numberValue(row.viaticos ?? row.costo_real_gastos),
      cobrado: options.duplicate ? false : Boolean(row.cobrado),
      retorno: Boolean(row.retorno),
      fecha_cobro: options.duplicate ? '' : dateInputValue(row.fecha_cobro),
      estado: options.duplicate ? 'programado' : row.estado,
      observaciones: row.observaciones ?? ''
    });
    this.precioRealManual = true;
    this.viaticosManual = true;
    this.syncCatalogInputs();
  }

  private applyCalculation(calculo: CalculoViaje, forcePrecioFlete: boolean) {
    if (forcePrecioFlete || numberValue(this.form.controls.precio_flete.value) <= 0) {
      this.form.controls.precio_flete.setValue(numberValue(calculo.precio_flete), { emitEvent: false });
    }

    this.form.patchValue(
      {
        galones_diesel: numberValue(calculo.galones_diesel),
        costo_diesel: numberValue(calculo.costo_diesel),
        costo_peajes: numberValue(calculo.costo_peajes),
        costo_estimado_gastos: numberValue(calculo.costo_estimado_gastos)
      },
      { emitEvent: false }
    );

    if (!this.precioRealManual) {
      this.form.controls.precio_real_flete.setValue(numberValue(calculo.precio_real_flete), {
        emitEvent: false
      });
    }

    if (!this.viaticosManual) {
      this.form.controls.viaticos.setValue(numberValue(calculo.costo_estimado_gastos), {
        emitEvent: false
      });
    }
  }

  private buildPayload() {
    const value = this.form.getRawValue();

    return {
      cliente_id: value.cliente_id,
      vehiculo_id: value.vehiculo_id,
      conductor_id: value.conductor_id,
      tarifa_ruta_id: value.tarifa_ruta_id,
      fecha_salida: value.fecha_salida,
      fecha_llegada: value.fecha_llegada || null,
      descripcion_carga: value.descripcion_carga || null,
      numeros_guia_remision: splitGuiasRemision(value.numeros_guia_remision),
      precio_flete: numberValue(value.precio_flete),
      precio_real_flete: numberValue(value.precio_real_flete),
      galones_diesel: numberValue(value.galones_diesel),
      costo_diesel: numberValue(value.costo_diesel),
      costo_peajes: numberValue(value.costo_peajes),
      costo_estimado_gastos: numberValue(value.costo_estimado_gastos),
      viaticos: numberValue(value.viaticos),
      costo_real_gastos: this.totalGastosReales(),
      cobrado: value.cobrado,
      retorno: value.retorno,
      fecha_cobro: value.cobrado ? value.fecha_cobro || todayInputDate() : null,
      estado: value.estado,
      observaciones: value.observaciones || null
    };
  }

  private setGastos(gastos: any[], options: { duplicate?: boolean } = {}) {
    this.gastos.set(
      gastos.map((item) => ({
        id: options.duplicate ? undefined : String(item.id),
        tipo_gasto_id: String(item.tipo_gasto_id),
        tipo_gasto_nombre: item.tipo_gasto?.nombre ?? `Gasto ${item.tipo_gasto_id}`,
        descripcion: item.descripcion ?? null,
        monto: numberValue(item.monto),
        es_estimado: Boolean(item.es_estimado)
      }))
    );
  }

  private syncGastos(viajeId: string) {
    const operations = [
      ...this.deletedGastoIds().map((id) => this.api.delete(`/viajes/${viajeId}/gastos/${id}`)),
      ...this.gastos().map((gasto) => {
        const payload = {
          tipo_gasto_id: gasto.tipo_gasto_id,
          descripcion: gasto.descripcion,
          monto: gasto.monto,
          fecha_gasto: this.form.controls.fecha_salida.value,
          es_estimado: gasto.es_estimado
        };

        return gasto.id
          ? this.api.put(`/viajes/${viajeId}/gastos/${gasto.id}`, payload)
          : this.api.post(`/viajes/${viajeId}/gastos`, payload);
      })
    ];

    return operations.length ? forkJoin(operations) : of([]);
  }

  private syncCatalogInputs() {
    (['cliente_id', 'vehiculo_id', 'conductor_id', 'tarifa_ruta_id', 'tipo_gasto_id'] as ViajeCatalogField[]).forEach((field) => {
      const value = field === 'tipo_gasto_id' ? this.gastoForm.controls.tipo_gasto_id.value : this.form.controls[field].value;
      const option = this.catalogOptions(field).find((item) => String(item.value) === String(value));
      this.catalogInput.update((current) => ({ ...current, [field]: option?.label ?? '' }));
    });
  }

  private tarifaLabel(tarifa: TarifaRutaOption) {
    const capacidad = tarifa.capacidad ? `, ${tarifa.capacidad} cartones` : '';
    return `${tarifa.ruta.origen} - ${tarifa.ruta.destino} / ${tarifa.tipo_carga.nombre}${capacidad} / $ ${this.money(tarifa.precio)}`;
  }

  private returnUrl() {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value?.startsWith('/movil/') ? value : null;
  }
}
