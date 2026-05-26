import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideCalculator,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSave,
  LucideSearch,
  LucideTrash2
} from '@lucide/angular';
import { Subscription, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';

type EstadoViaje = 'programado' | 'en_curso' | 'completado' | 'cancelado';
type ViajeCatalogField = 'cliente_id' | 'vehiculo_id' | 'conductor_id' | 'tarifa_ruta_id' | 'tipo_gasto_id';

interface SelectOption {
  value: string;
  label: string;
}

interface BasicOption {
  id: string;
  nombre: string;
  activo?: boolean;
}

interface ClienteOption extends BasicOption {
  ruc_cedula: string;
  porcentaje_comision: string | number;
}

interface VehiculoOption {
  id: string;
  placa: string;
  marca: string;
  modelo?: string | null;
}

interface ConductorOption extends BasicOption {
  cedula: string;
}

interface TarifaRutaOption {
  id: string;
  precio: string | number;
  capacidad?: number | null;
  toneladas?: string | number | null;
  ruta: {
    id: string;
    origen: string;
    destino: string;
    distancia_km: string | number;
  };
  tipo_carga: {
    nombre: string;
  };
}

interface TipoGastoOption extends BasicOption {}

interface ViajeRow {
  id: string;
  cliente_id: string;
  vehiculo_id: string;
  conductor_id: string;
  tarifa_ruta_id: string;
  cliente?: ClienteOption;
  vehiculo?: VehiculoOption;
  conductor?: ConductorOption;
  tarifa_ruta?: TarifaRutaOption;
  fecha_salida: string;
  fecha_llegada?: string | null;
  descripcion_carga?: string | null;
  peso_carga_kg?: string | number | null;
  numeros_guia_remision: string[];
  precio_flete: string | number;
  porcentaje_comision_aplicado: string | number;
  valor_comision: string | number;
  precio_real_flete: string | number;
  galones_diesel: string | number;
  costo_diesel: string | number;
  costo_peajes: string | number;
  costo_estimado_gastos: string | number;
  costo_real_gastos?: string | number | null;
  cobrado: boolean;
  fecha_cobro?: string | null;
  estado: EstadoViaje;
  observaciones?: string | null;
}

interface CalculoViaje {
  distancia_km: string | number;
  precio_flete: string | number;
  porcentaje_comision: string | number;
  valor_comision: string | number;
  precio_real_flete: string | number;
  precio_galon_diesel: string | number;
  galones_diesel: string | number;
  costo_diesel: string | number;
  costo_peajes: string | number;
  costo_estimado_gastos: string | number;
}

interface GastoViajeItem {
  id?: string;
  tipo_gasto_id: string;
  tipo_gasto_nombre: string;
  descripcion: string | null;
  monto: number;
  es_estimado: boolean;
}

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const todayInputDate = () => toDateInputValue(new Date());

const dateInputValue = (value?: string | null) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

@Component({
  selector: 'app-viajes-page',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    LucideCalculator,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSave,
    LucideSearch,
    LucideTrash2
  ],
  templateUrl: './viajes-page.component.html'
})
export class ViajesPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly sub = new Subscription();

  readonly rows = signal<ViajeRow[]>([]);
  readonly clientes = signal<ClienteOption[]>([]);
  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly conductores = signal<ConductorOption[]>([]);
  readonly tarifasRuta = signal<TarifaRutaOption[]>([]);
  readonly tiposGasto = signal<TipoGastoOption[]>([]);
  readonly gastos = signal<GastoViajeItem[]>([]);
  readonly deletedGastoIds = signal<string[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editingRow = signal<ViajeRow | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly search = signal('');
  readonly calculating = signal(false);
  readonly catalogInput = signal<Record<ViajeCatalogField, string>>({
    cliente_id: '',
    vehiculo_id: '',
    conductor_id: '',
    tarifa_ruta_id: '',
    tipo_gasto_id: ''
  });
  readonly activeCatalogField = signal<ViajeCatalogField | null>(null);

  private precioRealManual = false;
  private costoRealManual = false;

  readonly form = this.fb.nonNullable.group({
    cliente_id: ['', Validators.required],
    vehiculo_id: ['', Validators.required],
    conductor_id: ['', Validators.required],
    tarifa_ruta_id: ['', Validators.required],
    fecha_salida: [todayInputDate(), Validators.required],
    fecha_llegada: [todayInputDate()],
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
    costo_real_gastos: [0, [Validators.min(0)]],
    cobrado: [false],
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
        viajes: this.api.get<ViajeRow[]>('/viajes'),
        clientes: this.api.get<ClienteOption[]>('/clientes', { activo: true }),
        vehiculos: this.api.get<VehiculoOption[]>('/vehiculos'),
        conductores: this.api.get<ConductorOption[]>('/conductores', { estado: 'activo' }),
        tarifasRuta: this.api.get<TarifaRutaOption[]>('/tarifas-ruta', { activa: true }),
        tiposGasto: this.api.get<TipoGastoOption[]>('/tipos-gasto-viaje', { activo: true })
      }).subscribe({
        next: ({ viajes, clientes, vehiculos, conductores, tarifasRuta, tiposGasto }) => {
          this.rows.set(viajes);
          this.clientes.set(clientes);
          this.vehiculos.set(vehiculos);
          this.conductores.set(conductores);
          this.tarifasRuta.set(tarifasRuta);
          this.tiposGasto.set(tiposGasto);
          this.syncCatalogInputs();
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los viajes.');
          this.loading.set(false);
        }
      })
    );
  }

  filteredRows() {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.rows();

    return this.rows().filter((row) => JSON.stringify(row).toLowerCase().includes(term));
  }

  openCreate() {
    const today = todayInputDate();
    this.editingRow.set(null);
    this.form.reset({
      cliente_id: '',
      vehiculo_id: '',
      conductor_id: '',
      tarifa_ruta_id: '',
      fecha_salida: today,
      fecha_llegada: today,
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
      costo_real_gastos: 0,
      cobrado: false,
      fecha_cobro: '',
      estado: 'programado',
      observaciones: ''
    });
    this.gastos.set([]);
    this.deletedGastoIds.set([]);
    this.resetGastoForm();
    this.syncCatalogInputs();
    this.precioRealManual = false;
    this.costoRealManual = false;
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
      fecha_llegada: dateInputValue(row.fecha_llegada) || dateInputValue(row.fecha_salida),
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
      costo_real_gastos: numberValue(row.costo_real_gastos),
      cobrado: Boolean(row.cobrado),
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
    this.formOpen.set(true);
    this.error.set(null);
    this.message.set(null);
    this.loadGastos(row.id);
  }

  closeForm() {
    this.formOpen.set(false);
    this.editingRow.set(null);
    this.gastos.set([]);
    this.deletedGastoIds.set([]);
    this.saving.set(false);
    this.error.set(null);
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
    if (!llegada || llegada < salida) {
      this.form.controls.fecha_llegada.setValue(salida);
    }
    this.fetchCalculation({ resetPrecioReal: true });
  }

  onTarifaChange() {
    this.form.controls.precio_flete.setValue(0);
    this.fetchCalculation({ forcePrecioFlete: true, resetPrecioReal: true, resetCostoReal: true });
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
          fecha_salida: value.fecha_salida
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
      this.form.controls.costo_real_gastos.setValue(costoEstimado, { emitEvent: false });
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
    return roundMoney(numberValue(this.form.controls.costo_real_gastos.value) + this.totalGastosRealesAdicionales());
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
            this.load();
          },
          error: (err) => {
            this.error.set(err?.error?.message ?? 'No se pudo guardar el viaje.');
            this.saving.set(false);
          }
        })
    );
  }

  delete(row: ViajeRow) {
    if (!confirm(`Cancelar el viaje de ${row.cliente?.nombre ?? 'cliente'}?`)) return;

    this.deletingId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api.delete<ViajeRow>(`/viajes/${row.id}`).subscribe({
        next: () => {
          this.deletingId.set(null);
          this.message.set('Viaje cancelado.');
          this.load();
        },
        error: (err) => {
          this.deletingId.set(null);
          this.error.set(err?.error?.message ?? 'No se pudo cancelar el viaje.');
        }
      })
    );
  }

  private loadGastos(viajeId: string) {
    this.sub.add(
      this.api.get<any[]>(`/viajes/${viajeId}/gastos`).subscribe({
        next: (gastos) => {
          this.gastos.set(
            gastos.map((item) => ({
              id: String(item.id),
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
      numeros_guia_remision: String(value.numeros_guia_remision ?? '')
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      peso_carga_kg: numberValue(value.peso_carga_kg),
      precio_flete: numberValue(value.precio_flete),
      precio_real_flete: numberValue(value.precio_real_flete),
      galones_diesel: numberValue(value.galones_diesel),
      costo_diesel: numberValue(value.costo_diesel),
      costo_peajes: numberValue(value.costo_peajes),
      costo_estimado_gastos: numberValue(value.costo_estimado_gastos),
      costo_real_gastos: numberValue(value.costo_real_gastos),
      cobrado: value.cobrado,
      fecha_cobro: value.fecha_cobro || null,
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

  estadoLabel(estado: EstadoViaje) {
    const labels: Record<EstadoViaje, string> = {
      programado: 'Programado',
      en_curso: 'En curso',
      completado: 'Completado',
      cancelado: 'Cancelado'
    };

    return labels[estado] ?? estado;
  }

  rutaLabel(tarifa?: TarifaRutaOption) {
    if (!tarifa) return '-';
    return `${tarifa.ruta.origen} - ${tarifa.ruta.destino}`;
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
}
