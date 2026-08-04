import { Component, OnDestroy, inject, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideCalculator,
  LucidePlus,
  LucideSave,
  LucideTrash2
} from '@lucide/angular';
import { Subscription, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  type CalculoViaje,
  type ClienteOption,
  type ConductorOption,
  type EstadoViaje,
  type GastoViajeItem,
  type SelectOption,
  type TarifaRutaOption,
  type TipoGastoOption,
  type ViajeCatalogField,
  type ViajeRow,
  type VehiculoOption
} from './viaje-editor.models';
import {
  addDaysInputDate,
  dateInputValue,
  numberValue,
  roundMoney,
  splitGuiasRemision,
  todayInputDate
} from './viaje-editor.utils';

@Component({
  selector: 'app-viaje-editor-modal',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    LucideCalculator,
    LucidePlus,
    LucideSave,
    LucideTrash2
  ],
  templateUrl: './viaje-editor-modal.component.html'
})
export class ViajeEditorModalComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sub = new Subscription();
  private pendingEditId: string | null = null;
  private pendingDuplicateId: string | null = null;
  private pendingCreate = false;
  readonly clientes = signal<ClienteOption[]>([]);
  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly conductores = signal<ConductorOption[]>([]);
  readonly tarifasRuta = signal<TarifaRutaOption[]>([]);
  readonly tiposGasto = signal<TipoGastoOption[]>([]);
  readonly gastos = signal<GastoViajeItem[]>([]);
  readonly deletedGastoIds = signal<string[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly formOpen = signal(false);
  readonly editingRow = signal<ViajeRow | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly calculating = signal(false);
  readonly catalogInput = signal<Record<ViajeCatalogField, string>>({
    cliente_id: '',
    vehiculo_id: '',
    conductor_id: '',
    tarifa_ruta_id: '',
    tipo_gasto_id: ''
  });
  readonly activeCatalogField = signal<ViajeCatalogField | null>(null);
  readonly saved = output<void>();

  private precioRealManual = false;
  private costoRealManual = false;
  private fechaLlegadaManual = false;

  readonly form = this.fb.nonNullable.group({
    cliente_id: ['', Validators.required],
    vehiculo_id: ['', Validators.required],
    conductor_id: ['', Validators.required],
    tarifa_ruta_id: ['', Validators.required],
    fecha_salida: [todayInputDate(), Validators.required],
    fecha_llegada: [addDaysInputDate(todayInputDate(), 1)],
    descripcion_carga: [''],
    numeros_guia_remision: [''],
    peso_carga_kg: [0, [Validators.min(0)]],
    precio_flete: [0, [Validators.required, Validators.min(0.01)]],
    porcentaje_comision: [0],
    valor_comision: [0],
    precio_real_flete: [0, [Validators.min(0)]],
    distancia_km: [0],
    precio_galon_diesel: [0],
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
    es_estimado: [false],
    descripcion: ['']
  });

  constructor() {
    this.sub.add(
      this.route.queryParamMap.subscribe((params) => {
        this.pendingCreate = params.has('new');
        this.pendingEditId = params.get('edit') ?? params.get('editId');
        this.pendingDuplicateId = params.get('duplicate') ?? params.get('duplicateId');
        this.openPendingCreate();
        this.openPendingEdit();
        this.openPendingDuplicate();
      })
    );
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

    this.sub.add(
      forkJoin({
        clientes: this.api.get<ClienteOption[]>('/clientes', { activo: true, solo_propios: true }),
        vehiculos: this.api.get<VehiculoOption[]>('/vehiculos', { solo_propios: true }),
        conductores: this.api.get<ConductorOption[]>('/conductores', {
          estado: 'activo',
          solo_propios: true
        }),
        tarifasRuta: this.api.get<TarifaRutaOption[]>('/tarifas-ruta', {
          activa: true,
          solo_propios: true
        }),
        tiposGasto: this.api.get<TipoGastoOption[]>('/tipos-gasto-viaje', { activo: true })
      }).subscribe({
        next: ({ clientes, vehiculos, conductores, tarifasRuta, tiposGasto }) => {
          this.clientes.set(clientes);
          this.vehiculos.set(vehiculos);
          this.conductores.set(conductores);
          this.tarifasRuta.set(tarifasRuta);
          this.tiposGasto.set(tiposGasto);
          this.syncCatalogInputs();
          this.openPendingCreate();
          this.openPendingEdit();
          this.openPendingDuplicate();
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los catálogos del viaje.');
          this.loading.set(false);
        }
      })
    );
  }

  openCreate() {
    const today = todayInputDate();
    const tomorrow = addDaysInputDate(today, 1);
    const viaticosParam = this.route.snapshot.queryParamMap.get('viaticos');
    const hasManualViaticos =
      viaticosParam !== null && /^\d+(\.\d+)?$/.test(viaticosParam);
    this.editingRow.set(null);
    this.form.reset({
      cliente_id: '',
      vehiculo_id: '',
      conductor_id: '',
      tarifa_ruta_id: '',
      fecha_salida: today,
      fecha_llegada: tomorrow,
      descripcion_carga: '',
      numeros_guia_remision: '',
      peso_carga_kg: 0,
      precio_flete: 0,
      porcentaje_comision: 0,
      valor_comision: 0,
      precio_real_flete: 0,
      distancia_km: 0,
      precio_galon_diesel: 0,
      galones_diesel: 0,
      costo_diesel: 0,
      costo_peajes: 0,
      costo_estimado_gastos: 0,
      viaticos: 0,
      cobrado: false,
      retorno: false,
      fecha_cobro: '',
      estado: 'programado',
      observaciones: ''
    });
    this.precioRealManual = false;
    this.costoRealManual = hasManualViaticos;
    this.fechaLlegadaManual = false;
    this.applyCreatePrefill();
    this.gastos.set([]);
    this.deletedGastoIds.set([]);
    this.resetGastoForm();
    this.syncCatalogInputs();
    this.formOpen.set(true);
    this.error.set(null);
    this.message.set(null);
  }

  openEdit(row: ViajeRow) {
    this.editingRow.set(row);
    this.form.reset({
      cliente_id: String(row.cliente_id),
      vehiculo_id: String(row.vehiculo_id),
      conductor_id: String(row.conductor_id),
      tarifa_ruta_id: String(row.tarifa_ruta_id),
      fecha_salida: dateInputValue(row.fecha_salida),
      fecha_llegada: dateInputValue(row.fecha_llegada),
      descripcion_carga: row.descripcion_carga ?? '',
      numeros_guia_remision: (row.numeros_guia_remision ?? []).join('\n'),
      peso_carga_kg: numberValue(row.peso_carga_kg),
      precio_flete: numberValue(row.precio_flete),
      porcentaje_comision: numberValue(row.porcentaje_comision_aplicado),
      valor_comision: numberValue(row.valor_comision),
      precio_real_flete: numberValue(row.precio_real_flete),
      distancia_km: numberValue(row.tarifa_ruta?.ruta.distancia_km),
      precio_galon_diesel: 0,
      galones_diesel: numberValue(row.galones_diesel),
      costo_diesel: numberValue(row.costo_diesel),
      costo_peajes: numberValue(row.costo_peajes),
      costo_estimado_gastos: numberValue(row.costo_estimado_gastos),
      viaticos: numberValue(row.viaticos ?? row.costo_real_gastos),
      cobrado: Boolean(row.cobrado),
      retorno: Boolean(row.retorno),
      fecha_cobro: dateInputValue(row.fecha_cobro),
      estado: row.estado,
      observaciones: row.observaciones ?? ''
    });
    this.gastos.set([]);
    this.deletedGastoIds.set([]);
    this.resetGastoForm();
    this.syncCatalogInputs();
    this.precioRealManual = true;
    this.costoRealManual = true;
    this.fechaLlegadaManual = false;
    this.formOpen.set(true);
    this.error.set(null);
    this.message.set(null);
    this.loadGastos(row.id);
  }

  openDuplicate(row: ViajeRow) {
    this.editingRow.set(null);
    this.form.reset({
      cliente_id: String(row.cliente_id),
      vehiculo_id: String(row.vehiculo_id),
      conductor_id: String(row.conductor_id),
      tarifa_ruta_id: String(row.tarifa_ruta_id),
      fecha_salida: dateInputValue(row.fecha_salida),
      fecha_llegada: dateInputValue(row.fecha_llegada) || addDaysInputDate(dateInputValue(row.fecha_salida), 1),
      descripcion_carga: row.descripcion_carga ?? '',
      numeros_guia_remision: (row.numeros_guia_remision ?? []).join('\n'),
      peso_carga_kg: numberValue(row.peso_carga_kg),
      precio_flete: numberValue(row.precio_flete),
      porcentaje_comision: numberValue(row.porcentaje_comision_aplicado),
      valor_comision: numberValue(row.valor_comision),
      precio_real_flete: numberValue(row.precio_real_flete),
      distancia_km: numberValue(row.tarifa_ruta?.ruta.distancia_km),
      precio_galon_diesel: 0,
      galones_diesel: numberValue(row.galones_diesel),
      costo_diesel: numberValue(row.costo_diesel),
      costo_peajes: numberValue(row.costo_peajes),
      costo_estimado_gastos: numberValue(row.costo_estimado_gastos),
      viaticos: numberValue(row.viaticos ?? row.costo_real_gastos),
      cobrado: Boolean(row.cobrado),
      retorno: Boolean(row.retorno),
      fecha_cobro: dateInputValue(row.fecha_cobro),
      estado: row.estado,
      observaciones: row.observaciones ?? ''
    });
    this.gastos.set([]);
    this.deletedGastoIds.set([]);
    this.resetGastoForm();
    this.syncCatalogInputs();
    this.precioRealManual = true;
    this.costoRealManual = true;
    this.fechaLlegadaManual = false;
    this.formOpen.set(true);
    this.error.set(null);
    this.message.set(null);
    this.loadGastos(row.id, { duplicate: true });
  }

  closeForm() {
    const returnUrl = this.editReturnUrl();
    this.formOpen.set(false);
    this.editingRow.set(null);
    this.gastos.set([]);
    this.deletedGastoIds.set([]);
    this.saving.set(false);
    this.error.set(null);
    if (returnUrl) {
      void this.router.navigateByUrl(returnUrl);
      return;
    }
    this.clearReturnQuery();
  }

  openCatalog(field: ViajeCatalogField) {
    this.activeCatalogField.set(field);
  }

  closeCatalogSoon(field: ViajeCatalogField) {
    window.setTimeout(() => {
      if (this.activeCatalogField() === field) {
        this.activeCatalogField.set(null);
      }
    }, 150);
  }

  catalogOpen(field: ViajeCatalogField) {
    return this.activeCatalogField() === field;
  }

  catalogInputValue(field: ViajeCatalogField) {
    return this.catalogInput()[field] ?? '';
  }

  setCatalogInput(field: ViajeCatalogField, value: string) {
    this.catalogInput.update((current) => ({ ...current, [field]: value }));
    const match = this.catalogOptions(field).find((option) => option.label.toLowerCase() === value.trim().toLowerCase());
    this.setCatalogControlValue(field, match?.value ?? '', Boolean(match));
    this.activeCatalogField.set(field);
  }

  selectCatalogOption(field: ViajeCatalogField, option: SelectOption, event?: MouseEvent) {
    event?.preventDefault();
    this.catalogInput.update((current) => ({ ...current, [field]: option.label }));
    this.setCatalogControlValue(field, option.value, true);
    this.activeCatalogField.set(null);
  }

  limitedCatalogOptions(field: ViajeCatalogField) {
    const term = this.catalogInputValue(field).trim().toLowerCase();
    const options = this.catalogOptions(field);

    return (term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options).slice(0, 30);
  }

  onFechaSalidaChange() {
    const salida = this.form.controls.fecha_salida.value;
    const llegada = this.form.controls.fecha_llegada.value;

    if (!this.editingRow() && (!this.fechaLlegadaManual || !llegada)) {
      this.form.controls.fecha_llegada.setValue(addDaysInputDate(salida, 1));
    }

    this.fetchCalculation({ resetPrecioReal: true });
  }

  onFechaLlegadaChange() {
    this.fechaLlegadaManual = true;
  }

  onTarifaChange() {
    const preserveViaticos = Boolean(this.editingRow());

    this.form.controls.precio_flete.setValue(0);
    this.fetchCalculation({
      forcePrecioFlete: true,
      resetPrecioReal: true,
      resetCostoReal: !preserveViaticos
    });
  }

  onCalculationInputChanged() {
    this.fetchCalculation({ resetPrecioReal: true });
  }

  onPrecioFleteChanged() {
    this.fetchCalculation({ resetPrecioReal: true });
  }

  onPrecioRealChanged() {
    this.precioRealManual = true;
  }

  onCostoRealChanged() {
    this.costoRealManual = true;
  }

  fetchCalculation(options: { forcePrecioFlete?: boolean; resetPrecioReal?: boolean; resetCostoReal?: boolean } = {}) {
    const value = this.form.getRawValue();
    if (!value.cliente_id || !value.vehiculo_id || !value.tarifa_ruta_id) return;

    if (options.resetPrecioReal) this.precioRealManual = false;
    if (options.resetCostoReal) this.costoRealManual = false;

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
            this.error.set(err?.error?.message ?? 'No se pudieron calcular los valores del viaje.');
            this.calculating.set(false);
          }
        })
    );
  }

  applyCalculation(calculo: CalculoViaje, forcePrecioFlete: boolean) {
    if (forcePrecioFlete || numberValue(this.form.controls.precio_flete.value) <= 0) {
      this.form.controls.precio_flete.setValue(numberValue(calculo.precio_flete), { emitEvent: false });
    }

    this.form.patchValue(
      {
        porcentaje_comision: numberValue(calculo.porcentaje_comision),
        valor_comision: numberValue(calculo.valor_comision),
        distancia_km: numberValue(calculo.distancia_km),
        precio_galon_diesel: numberValue(calculo.precio_galon_diesel),
        galones_diesel: numberValue(calculo.galones_diesel),
        costo_diesel: numberValue(calculo.costo_diesel),
        costo_peajes: numberValue(calculo.costo_peajes)
      },
      { emitEvent: false }
    );

    if (!this.precioRealManual) {
      this.form.controls.precio_real_flete.setValue(numberValue(calculo.precio_real_flete), {
        emitEvent: false
      });
    }

    this.recalculateTotals();
  }

  resetGastoForm() {
    this.gastoForm.reset({
      tipo_gasto_id: '',
      monto: 0,
      es_estimado: false,
      descripcion: ''
    });
    this.syncCatalogInput('tipo_gasto_id');
  }

  addGasto() {
    const value = this.gastoForm.getRawValue();
    const tipo = this.tiposGasto().find((item) => String(item.id) === String(value.tipo_gasto_id));
    if (!tipo || numberValue(value.monto) <= 0) {
      this.gastoForm.markAllAsTouched();
      return;
    }

    this.gastos.update((current) => [
      ...current,
      {
        tipo_gasto_id: tipo.id,
        tipo_gasto_nombre: tipo.nombre,
        descripcion: value.descripcion || null,
        monto: roundMoney(numberValue(value.monto)),
        es_estimado: value.es_estimado
      }
    ]);
    this.resetGastoForm();
    this.recalculateTotals();
  }

  removeGasto(index: number) {
    const gasto = this.gastos()[index];
    if (gasto?.id) {
      this.deletedGastoIds.update((current) => [...current, gasto.id!]);
    }
    this.gastos.update((current) => current.filter((_item, itemIndex) => itemIndex !== index));
    this.recalculateTotals();
  }

  recalculateTotals() {
    const costoEstimado = roundMoney(
      numberValue(this.form.controls.costo_diesel.value) +
        numberValue(this.form.controls.costo_peajes.value) +
        this.totalGastosEstimados()
    );
    this.form.controls.costo_estimado_gastos.setValue(costoEstimado, { emitEvent: false });

    if (!this.costoRealManual) {
      this.form.controls.viaticos.setValue(costoEstimado, { emitEvent: false });
    }
  }

  totalGastosEstimados() {
    return roundMoney(
      this.gastos()
        .filter((item) => item.es_estimado)
        .reduce((total, item) => total + numberValue(item.monto), 0)
    );
  }

  totalGastosRealesAdicionales() {
    return roundMoney(
      this.gastos()
        .filter((item) => !item.es_estimado)
        .reduce((total, item) => total + numberValue(item.monto), 0)
    );
  }

  totalGastosReales() {
    return roundMoney(numberValue(this.form.controls.viaticos.value) + this.totalGastosRealesAdicionales());
  }

  utilidadViaje() {
    return roundMoney(numberValue(this.form.controls.precio_real_flete.value) - this.totalGastosReales());
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const row = this.editingRow();
    const returnUrl = this.editReturnUrl();
    const payload = this.buildPayload();
    const request = row
      ? this.api.put<ViajeRow>(`/viajes/${row.id}`, payload)
      : this.api.post<ViajeRow>('/viajes', payload);

    this.saving.set(true);
    this.error.set(null);

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
          next: (viaje) => {
            this.saving.set(false);
            this.formOpen.set(false);
            this.message.set(row ? 'Viaje actualizado.' : 'Viaje creado.');
            this.saved.emit();
            if (returnUrl) {
              void this.router.navigateByUrl(returnUrl);
              return;
            }
            this.clearReturnQuery();
          },
          error: (err) => {
            this.error.set(err?.error?.message ?? 'No se pudo guardar el viaje.');
            this.saving.set(false);
          }
        })
    );
  }

  /* List actions are handled by ReportsPageComponent.
  async marcarCobrado(row: ViajeRow) {
    if (row.cobrado || row.estado === 'cancelado') return;

    const support = await this.dialog.supportPrompt({
      title: 'Marcar viaje como cobrado',
      text: `Se registrará la fecha de cobro de hoy para el viaje de ${row.cliente?.nombre ?? 'este cliente'}.`,
      confirmText: 'Sí, marcar cobrado'
    });

    if (!support) return;

    this.markingCobroId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api
        .patch<ViajeRow>(`/viajes/${row.id}/cobro`, {
          cobrado: true,
          fecha_cobro: support.fecha,
          soporte_cobro: support.soporte,
          sin_factura_cobro: support.sin_factura
        })
        .subscribe({
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

  async delete(row: ViajeRow) {
    const isCancelado = row.estado === 'cancelado';
    const action = isCancelado ? 'eliminar definitivamente' : 'cancelar';
    const confirmed = await this.dialog.confirm({
      title: isCancelado ? 'Eliminar viaje definitivamente' : 'Cancelar viaje',
      text: isCancelado
        ? `Esta acción quitará de la tabla el viaje de ${row.cliente?.nombre ?? 'este cliente'}.`
        : `El viaje de ${row.cliente?.nombre ?? 'este cliente'} quedará con estado cancelado.`,
      confirmText: isCancelado ? 'Sí, eliminar' : 'Sí, cancelar'
    });

    if (!confirmed) return;

    this.deletingId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api.delete<ViajeRow>(`/viajes/${row.id}`).subscribe({
        next: () => {
          this.deletingId.set(null);
          this.message.set(isCancelado ? 'Viaje eliminado.' : 'Viaje cancelado.');
          this.load();
        },
        error: (err) => {
          this.deletingId.set(null);
          this.error.set(err?.error?.message ?? `No se pudo ${action} el viaje.`);
        }
      })
    );
  }

  */
  private loadGastos(viajeId: string, options: { duplicate?: boolean } = {}) {
    this.sub.add(
      this.api.get<any[]>(`/viajes/${viajeId}/gastos`).subscribe({
        next: (gastos) => {
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
          this.recalculateTotals();
        },
        error: () => {
          this.gastos.set([]);
        }
      })
    );
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
      peso_carga_kg: numberValue(value.peso_carga_kg),
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

  money(value: unknown) {
    return numberValue(value).toFixed(2);
  }

  tarifaLabel(tarifa: TarifaRutaOption) {
    const capacidad = tarifa.capacidad ? `, ${tarifa.capacidad} cartones` : '';
    return `${tarifa.ruta.origen} - ${tarifa.ruta.destino} / ${tarifa.tipo_carga.nombre}${capacidad} / $ ${this.money(tarifa.precio)}`;
  }

  private catalogOptions(field: ViajeCatalogField): SelectOption[] {
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

  private setCatalogControlValue(field: ViajeCatalogField, value: string, triggerChange = true) {
    if (field === 'tipo_gasto_id') {
      this.gastoForm.controls.tipo_gasto_id.setValue(value);
      return;
    }

    this.form.controls[field].setValue(value);
    if (!triggerChange) return;

    if (field === 'tarifa_ruta_id') {
      this.onTarifaChange();
      return;
    }

    if (field === 'cliente_id' || field === 'vehiculo_id') {
      this.onCalculationInputChanged();
    }
  }

  private syncCatalogInputs() {
    (['cliente_id', 'vehiculo_id', 'conductor_id', 'tarifa_ruta_id', 'tipo_gasto_id'] as ViajeCatalogField[]).forEach(
      (field) => this.syncCatalogInput(field)
    );
  }

  private syncCatalogInput(field: ViajeCatalogField) {
    const value =
      field === 'tipo_gasto_id'
        ? this.gastoForm.controls.tipo_gasto_id.value
        : this.form.controls[field].value;
    const option = this.catalogOptions(field).find((item) => String(item.value) === String(value));
    this.catalogInput.update((current) => ({ ...current, [field]: option?.label ?? '' }));
  }

  private openPendingEdit() {
    if (!this.pendingEditId) return;
    const id = this.pendingEditId;
    this.pendingEditId = null;
    this.sub.add(
      this.api.get<ViajeRow>(`/viajes/${id}`).subscribe({
        next: (response) => {
          this.openEdit(response);
          this.clearEditQuery();
        },
        error: () => {
          this.error.set('No se encontró el viaje solicitado.');
          this.clearEditQuery();
        }
      })
    );
  }

  /* Legacy list lookup retired with the old trips page.
  private legacyOpenPendingEdit() {
    if (!this.pendingEditId) return;

    const row = this.rows().find((item) => String(item.id) === this.pendingEditId);
    if (!row) {
      const id = this.pendingEditId;
      this.sub.add(
        this.api.get<ViajeRow>(`/viajes/${id}`).subscribe({
          next: (response) => {
            if (this.pendingEditId !== id) return;
            this.pendingEditId = null;
            this.openEdit(response);
            this.clearEditQuery();
          },
          error: () => {
            this.error.set('No se encontró el viaje solicitado.');
            this.pendingEditId = null;
            this.clearEditQuery();
          }
        })
      );
      return;
    }

    this.pendingEditId = null;
    this.openEdit(row);
    this.clearEditQuery();
  }

  }
  */

  private openPendingCreate() {
    if (!this.pendingCreate) return;
    this.pendingCreate = false;
    this.openCreate();
    this.clearEditQuery();
  }

  private applyCreatePrefill() {
    const params = this.route.snapshot.queryParamMap;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const numberPattern = /^\d+(\.\d+)?$/;
    const patch: Partial<ReturnType<typeof this.form.getRawValue>> = {};

    for (const field of ['cliente_id', 'vehiculo_id', 'conductor_id', 'tarifa_ruta_id'] as const) {
      const value = params.get(field);
      if (value) patch[field] = value;
    }

    const fechaSalida = params.get('fecha_salida');
    const fechaLlegada = params.get('fecha_llegada');
    if (fechaSalida && datePattern.test(fechaSalida)) patch.fecha_salida = fechaSalida;
    if (fechaLlegada && datePattern.test(fechaLlegada)) patch.fecha_llegada = fechaLlegada;

    const guias = params.get('numeros_guia_remision');
    if (guias) patch.numeros_guia_remision = guias;

    const precioFlete = params.get('precio_flete');
    if (precioFlete && numberPattern.test(precioFlete)) patch.precio_flete = Number(precioFlete);

    const viaticos = params.get('viaticos');
    if (viaticos && numberPattern.test(viaticos)) patch.viaticos = Number(viaticos);

    if (!Object.keys(patch).length) return;

    this.form.patchValue(patch, { emitEvent: false });
    this.syncCatalogInputs();
    this.onCalculationInputChanged();
  }

  private openPendingDuplicate() {
    if (!this.pendingDuplicateId) return;
    const id = this.pendingDuplicateId;
    this.pendingDuplicateId = null;
    this.sub.add(
      this.api.get<ViajeRow>(`/viajes/${id}`).subscribe({
        next: (response) => {
          this.openDuplicate(response);
          this.clearEditQuery();
        },
        error: () => {
          this.error.set('No se encontró el viaje solicitado.');
          this.clearEditQuery();
        }
      })
    );
  }

  /* Legacy list lookup retired with the old trips page.
  private legacyOpenPendingDuplicate() {
    if (!this.pendingDuplicateId) return;

    const row = this.rows().find((item) => String(item.id) === this.pendingDuplicateId);
    if (!row) {
      const id = this.pendingDuplicateId;
      this.sub.add(
        this.api.get<ViajeRow>(`/viajes/${id}`).subscribe({
          next: (response) => {
            if (this.pendingDuplicateId !== id) return;
            this.pendingDuplicateId = null;
            this.openDuplicate(response);
            this.clearEditQuery();
          },
          error: () => {
            this.error.set('No se encontró el viaje solicitado.');
            this.pendingDuplicateId = null;
            this.clearEditQuery();
          }
        })
      );
      return;
    }

    this.pendingDuplicateId = null;
    this.openDuplicate(row);
    this.clearEditQuery();
  }

  }
  */

  private clearEditQuery() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        new: null,
        edit: null,
        editId: null,
        duplicate: null,
        duplicateId: null,
        cliente_id: null,
        vehiculo_id: null,
        conductor_id: null,
        tarifa_ruta_id: null,
        fecha_salida: null,
        fecha_llegada: null,
        numeros_guia_remision: null,
        precio_flete: null,
        viaticos: null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private editReturnUrl() {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    return returnUrl?.startsWith('/app/') ? returnUrl : null;
  }

  private clearReturnQuery() {
    if (!this.route.snapshot.queryParamMap.has('returnUrl')) return;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { returnUrl: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

}
