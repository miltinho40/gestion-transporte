import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSave,
  LucideSearch,
  LucideTrash2,
  LucideX
} from '@lucide/angular';
import { Subscription, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';

type EstadoMantenimiento = 'programado' | 'realizado' | 'cancelado' | 'vencido';
type CatalogField = 'vehiculo_id' | 'tipo_mantenimiento_id';

interface SelectOption {
  value: string;
  label: string;
}

interface VehiculoOption {
  id: string;
  placa: string;
  marca: string;
  modelo?: string | null;
  kilometraje_actual: string | number;
  estado: string;
}

interface TipoMantenimientoOption {
  id: string;
  nombre: string;
  descripcion?: string | null;
  es_periodico: boolean;
  intervalo_km?: number | null;
  intervalo_dias?: number | null;
  activo: boolean;
}

interface RepuestoItem {
  id?: string;
  nombre_repuesto: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
}

interface MantenimientoRow {
  id: string;
  vehiculo_id: string;
  tipo_mantenimiento_id: string;
  fecha_mantenimiento: string;
  kilometraje_actual_vehiculo: number | string;
  descripcion?: string | null;
  costo_mano_obra: number | string;
  costo_repuestos: number | string;
  costo_total: number | string;
  proximo_mantenimiento_km?: number | string | null;
  proximo_mantenimiento_fecha?: string | null;
  estado: EstadoMantenimiento;
  vehiculo?: VehiculoOption | null;
  tipo_mantenimiento?: TipoMantenimientoOption | null;
  repuestos?: RepuestoItem[];
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

const nullableNumberValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const addDaysInput = (dateInput: string, days: number) => {
  if (!dateInput) return '';
  const date = new Date(`${dateInput}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
};

@Component({
  selector: 'app-mantenimientos-page',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSave,
    LucideSearch,
    LucideTrash2,
    LucideX
  ],
  templateUrl: './mantenimientos-page.component.html'
})
export class MantenimientosPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly sub = new Subscription();

  readonly rows = signal<MantenimientoRow[]>([]);
  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly tiposMantenimiento = signal<TipoMantenimientoOption[]>([]);
  readonly repuestos = signal<RepuestoItem[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editingRow = signal<MantenimientoRow | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly search = signal('');
  readonly catalogInput = signal<Record<CatalogField, string>>({
    vehiculo_id: '',
    tipo_mantenimiento_id: ''
  });
  readonly activeCatalogField = signal<CatalogField | null>(null);

  readonly form = this.fb.group({
    vehiculo_id: ['', Validators.required],
    tipo_mantenimiento_id: ['', Validators.required],
    fecha_mantenimiento: [todayInputDate(), Validators.required],
    kilometraje_actual_vehiculo: [0, [Validators.required, Validators.min(0)]],
    descripcion: [''],
    costo_mano_obra: [0, [Validators.min(0)]],
    costo_repuestos: [0],
    costo_total: [0],
    proximo_mantenimiento_km: this.fb.control<number | null>(null),
    proximo_mantenimiento_fecha: [''],
    estado: ['realizado' as EstadoMantenimiento, Validators.required],
    actualizar_kilometraje_vehiculo: [true]
  });

  readonly repuestoForm = this.fb.group({
    nombre_repuesto: ['', Validators.required],
    cantidad: [1, [Validators.required, Validators.min(0.01)]],
    costo_unitario: [0, [Validators.required, Validators.min(0)]]
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
        mantenimientos: this.api.get<MantenimientoRow[]>('/mantenimientos'),
        vehiculos: this.api.get<VehiculoOption[]>('/vehiculos'),
        tipos: this.api.get<TipoMantenimientoOption[]>('/tipos-mantenimiento', { activo: true })
      }).subscribe({
        next: ({ mantenimientos, vehiculos, tipos }) => {
          this.rows.set(mantenimientos);
          this.vehiculos.set(vehiculos);
          this.tiposMantenimiento.set(tipos);
          this.syncCatalogInputs();
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los mantenimientos.');
          this.loading.set(false);
        }
      })
    );
  }

  openCreate() {
    this.editingRow.set(null);
    this.form.reset({
      vehiculo_id: '',
      tipo_mantenimiento_id: '',
      fecha_mantenimiento: todayInputDate(),
      kilometraje_actual_vehiculo: 0,
      descripcion: '',
      costo_mano_obra: 0,
      costo_repuestos: 0,
      costo_total: 0,
      proximo_mantenimiento_km: null,
      proximo_mantenimiento_fecha: '',
      estado: 'realizado',
      actualizar_kilometraje_vehiculo: true
    });
    this.repuestos.set([]);
    this.resetRepuestoForm();
    this.syncCatalogInputs();
    this.formOpen.set(true);
    this.message.set(null);
    this.error.set(null);
  }

  openEdit(row: MantenimientoRow) {
    this.editingRow.set(row);
    this.form.reset({
      vehiculo_id: String(row.vehiculo_id),
      tipo_mantenimiento_id: String(row.tipo_mantenimiento_id),
      fecha_mantenimiento: dateInputValue(row.fecha_mantenimiento),
      kilometraje_actual_vehiculo: numberValue(row.kilometraje_actual_vehiculo),
      descripcion: row.descripcion ?? '',
      costo_mano_obra: numberValue(row.costo_mano_obra),
      costo_repuestos: numberValue(row.costo_repuestos),
      costo_total: numberValue(row.costo_total),
      proximo_mantenimiento_km: nullableNumberValue(row.proximo_mantenimiento_km),
      proximo_mantenimiento_fecha: dateInputValue(row.proximo_mantenimiento_fecha),
      estado: row.estado,
      actualizar_kilometraje_vehiculo: false
    });
    this.repuestos.set(
      (row.repuestos ?? []).map((repuesto) => ({
        id: repuesto.id,
        nombre_repuesto: repuesto.nombre_repuesto,
        cantidad: numberValue(repuesto.cantidad),
        costo_unitario: numberValue(repuesto.costo_unitario),
        costo_total: numberValue(repuesto.costo_total)
      }))
    );
    this.resetRepuestoForm();
    this.syncCatalogInputs();
    this.formOpen.set(true);
    this.message.set(null);
    this.error.set(null);
    this.recalculateTotals();
  }

  closeForm() {
    this.formOpen.set(false);
    this.editingRow.set(null);
    this.activeCatalogField.set(null);
    this.error.set(null);
    this.saving.set(false);
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.recalculateTotals();
    const row = this.editingRow();
    const payload = this.buildPayload();
    const request = row
      ? this.api.put<MantenimientoRow>(`/mantenimientos/${row.id}`, payload)
      : this.api.post<MantenimientoRow>('/mantenimientos', payload);

    this.saving.set(true);
    this.error.set(null);

    this.sub.add(
      request.subscribe({
        next: () => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.editingRow.set(null);
          this.message.set(row ? 'Mantenimiento actualizado.' : 'Mantenimiento creado.');
          this.load();
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudo guardar el mantenimiento.');
          this.saving.set(false);
        }
      })
    );
  }

  delete(row: MantenimientoRow) {
    if (!confirm(`Cancelar mantenimiento de ${this.vehiculoLabel(row.vehiculo)}?`)) return;

    this.deletingId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api.delete<MantenimientoRow>(`/mantenimientos/${row.id}`).subscribe({
        next: () => {
          this.deletingId.set(null);
          this.message.set('Mantenimiento cancelado.');
          this.load();
        },
        error: (err) => {
          this.deletingId.set(null);
          this.error.set(err?.error?.message ?? 'No se pudo cancelar el mantenimiento.');
        }
      })
    );
  }

  filteredRows() {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.rows();

    return this.rows().filter((row) => JSON.stringify(row).toLowerCase().includes(term));
  }

  openCatalog(field: CatalogField) {
    this.activeCatalogField.set(field);
  }

  closeCatalogSoon(field: CatalogField) {
    this.form.controls[field].markAsTouched();

    window.setTimeout(() => {
      if (this.activeCatalogField() === field) {
        this.activeCatalogField.set(null);
      }
    }, 150);
  }

  catalogOpen(field: CatalogField) {
    return this.activeCatalogField() === field;
  }

  catalogInputValue(field: CatalogField) {
    return this.catalogInput()[field] ?? '';
  }

  setCatalogInput(field: CatalogField, value: string) {
    this.catalogInput.update((current) => ({ ...current, [field]: value }));
    const match = this.catalogOptions(field).find(
      (option) => option.label.toLowerCase() === value.trim().toLowerCase()
    );
    this.setCatalogControlValue(field, match?.value ?? '', Boolean(match));
    this.activeCatalogField.set(field);
  }

  selectCatalogOption(field: CatalogField, option: SelectOption, event?: MouseEvent) {
    event?.preventDefault();
    this.catalogInput.update((current) => ({ ...current, [field]: option.label }));
    this.setCatalogControlValue(field, option.value, true);
    this.activeCatalogField.set(null);
  }

  limitedCatalogOptions(field: CatalogField) {
    const term = this.catalogInputValue(field).trim().toLowerCase();
    const options = this.catalogOptions(field);
    if (!term) return options.slice(0, 30);

    return options.filter((option) => option.label.toLowerCase().includes(term)).slice(0, 30);
  }

  onVehiculoChanged() {
    const vehiculo = this.selectedVehiculo();
    if (!vehiculo) return;

    this.form.controls.kilometraje_actual_vehiculo.setValue(
      numberValue(vehiculo.kilometraje_actual),
      { emitEvent: false }
    );
    this.recalculateProximoMantenimiento();
  }

  onTipoMantenimientoChanged() {
    this.recalculateProximoMantenimiento();
  }

  onBaseMantenimientoChanged() {
    this.recalculateProximoMantenimiento();
  }

  addRepuesto() {
    if (this.repuestoForm.invalid) {
      this.repuestoForm.markAllAsTouched();
      return;
    }

    const value = this.repuestoForm.getRawValue();
    const cantidad = numberValue(value.cantidad);
    const costoUnitario = numberValue(value.costo_unitario);

    this.repuestos.update((current) => [
      ...current,
      {
        nombre_repuesto: String(value.nombre_repuesto ?? '').trim(),
        cantidad,
        costo_unitario: costoUnitario,
        costo_total: roundMoney(cantidad * costoUnitario)
      }
    ]);
    this.resetRepuestoForm();
    this.recalculateTotals();
  }

  removeRepuesto(index: number) {
    this.repuestos.update((current) => current.filter((_item, itemIndex) => itemIndex !== index));
    this.recalculateTotals();
  }

  resetRepuestoForm() {
    this.repuestoForm.reset({
      nombre_repuesto: '',
      cantidad: 1,
      costo_unitario: 0
    });
  }

  repuestoFormTotal() {
    const value = this.repuestoForm.getRawValue();
    return roundMoney(numberValue(value.cantidad) * numberValue(value.costo_unitario));
  }

  repuestosTotal() {
    return roundMoney(this.repuestos().reduce((total, repuesto) => total + repuesto.costo_total, 0));
  }

  totalMantenimiento() {
    return roundMoney(numberValue(this.form.controls.costo_mano_obra.value) + this.repuestosTotal());
  }

  recalculateTotals() {
    this.form.controls.costo_repuestos.setValue(this.repuestosTotal(), { emitEvent: false });
    this.form.controls.costo_total.setValue(this.totalMantenimiento(), { emitEvent: false });
  }

  money(value: unknown) {
    return numberValue(value).toFixed(2);
  }

  estadoLabel(value: unknown) {
    const labels: Record<string, string> = {
      programado: 'Programado',
      realizado: 'Realizado',
      cancelado: 'Cancelado',
      vencido: 'Vencido'
    };

    return labels[String(value)] ?? String(value ?? '-');
  }

  badgeClass(value: unknown) {
    const text = String(value ?? '').toLowerCase();
    if (text.includes('venc') || text.includes('cancel')) return 'badge-soft-danger';
    if (text.includes('program')) return 'badge-soft-warning';
    return 'badge-soft';
  }

  vehiculoLabel(vehiculo?: VehiculoOption | null) {
    if (!vehiculo) return '-';
    return [vehiculo.placa, vehiculo.marca].filter(Boolean).join(' - ');
  }

  tipoMantenimientoLabel(tipo?: TipoMantenimientoOption | null) {
    return tipo?.nombre ?? '-';
  }

  controlInvalid(name: keyof typeof this.form.controls) {
    const control = this.form.controls[name];
    return Boolean(control.invalid && (control.dirty || control.touched));
  }

  repuestoControlInvalid(name: keyof typeof this.repuestoForm.controls) {
    const control = this.repuestoForm.controls[name];
    return Boolean(control.invalid && (control.dirty || control.touched));
  }

  private catalogOptions(field: CatalogField): SelectOption[] {
    if (field === 'vehiculo_id') {
      return this.vehiculos().map((vehiculo) => ({
        value: String(vehiculo.id),
        label: [vehiculo.placa, vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' - ')
      }));
    }

    return this.tiposMantenimiento().map((tipo) => ({
      value: String(tipo.id),
      label: tipo.nombre
    }));
  }

  private setCatalogControlValue(field: CatalogField, value: string, triggerChange: boolean) {
    this.form.controls[field].setValue(value, { emitEvent: false });
    this.form.controls[field].markAsDirty();

    if (!triggerChange) return;
    if (field === 'vehiculo_id') this.onVehiculoChanged();
    if (field === 'tipo_mantenimiento_id') this.onTipoMantenimientoChanged();
  }

  private syncCatalogInputs() {
    const next: Record<CatalogField, string> = {
      vehiculo_id: '',
      tipo_mantenimiento_id: ''
    };

    for (const field of Object.keys(next) as CatalogField[]) {
      const value = this.form.controls[field].value;
      const option = this.catalogOptions(field).find((item) => item.value === String(value));
      next[field] = option?.label ?? '';
    }

    this.catalogInput.set(next);
  }

  private selectedVehiculo() {
    const id = String(this.form.controls.vehiculo_id.value ?? '');
    return this.vehiculos().find((vehiculo) => String(vehiculo.id) === id) ?? null;
  }

  private selectedTipoMantenimiento() {
    const id = String(this.form.controls.tipo_mantenimiento_id.value ?? '');
    return this.tiposMantenimiento().find((tipo) => String(tipo.id) === id) ?? null;
  }

  private recalculateProximoMantenimiento() {
    const tipo = this.selectedTipoMantenimiento();
    if (!tipo) return;

    const kilometraje = numberValue(this.form.controls.kilometraje_actual_vehiculo.value);
    const fecha = this.form.controls.fecha_mantenimiento.value ?? '';

    if (tipo.intervalo_km) {
      this.form.controls.proximo_mantenimiento_km.setValue(kilometraje + Number(tipo.intervalo_km), {
        emitEvent: false
      });
    }

    if (tipo.intervalo_dias) {
      this.form.controls.proximo_mantenimiento_fecha.setValue(
        addDaysInput(fecha, Number(tipo.intervalo_dias)),
        { emitEvent: false }
      );
    }
  }

  private buildPayload() {
    const value = this.form.getRawValue();

    return {
      vehiculo_id: value.vehiculo_id,
      tipo_mantenimiento_id: value.tipo_mantenimiento_id,
      fecha_mantenimiento: value.fecha_mantenimiento,
      kilometraje_actual_vehiculo: numberValue(value.kilometraje_actual_vehiculo),
      descripcion: value.descripcion?.trim() || null,
      costo_mano_obra: numberValue(value.costo_mano_obra),
      proximo_mantenimiento_km: nullableNumberValue(value.proximo_mantenimiento_km),
      proximo_mantenimiento_fecha: value.proximo_mantenimiento_fecha || null,
      estado: value.estado,
      actualizar_kilometraje_vehiculo: Boolean(value.actualizar_kilometraje_vehiculo),
      repuestos: this.repuestos().map((repuesto) => ({
        nombre_repuesto: repuesto.nombre_repuesto,
        cantidad: repuesto.cantidad,
        costo_unitario: repuesto.costo_unitario
      }))
    };
  }
}
