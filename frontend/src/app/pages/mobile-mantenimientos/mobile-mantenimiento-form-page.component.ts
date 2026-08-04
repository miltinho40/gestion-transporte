import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideArrowLeft, LucidePlus, LucideSave, LucideTrash2 } from '@lucide/angular';
import { Subscription, forkJoin, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import {
  EstadoMantenimiento,
  MantenimientoCatalogField,
  MantenimientoRow,
  RepuestoItem,
  SelectOption,
  TipoMantenimientoOption,
  VehiculoOption,
  addDaysInputDate,
  dateInputValue,
  nullableNumberValue,
  numberValue,
  roundMoney,
  todayInputDate
} from './mobile-mantenimientos.types';

@Component({
  selector: 'app-mobile-mantenimiento-form-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    LucideArrowLeft,
    LucidePlus,
    LucideSave,
    LucideTrash2,
    AutoDismissAlertDirective
  ],
  templateUrl: './mobile-mantenimiento-form-page.component.html',
  styleUrl: './mobile-mantenimiento-form-page.component.scss'
})
export class MobileMantenimientoFormPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sub = new Subscription();

  readonly mantenimientoId = this.route.snapshot.paramMap.get('id');
  readonly duplicateFromId = this.route.snapshot.queryParamMap.get('duplicateFrom');
  readonly editing = Boolean(this.mantenimientoId);
  readonly duplicating = !this.editing && Boolean(this.duplicateFromId);
  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly tipos = signal<TipoMantenimientoOption[]>([]);
  readonly repuestos = signal<RepuestoItem[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly catalogInput = signal<Record<MantenimientoCatalogField, string>>({
    vehiculo_id: '',
    tipo_mantenimiento_id: ''
  });

  readonly form = this.fb.nonNullable.group({
    vehiculo_id: ['', Validators.required],
    tipo_mantenimiento_id: ['', Validators.required],
    fecha_mantenimiento: [todayInputDate(), Validators.required],
    kilometraje_actual_vehiculo: [0, [Validators.required, Validators.min(0)]],
    descripcion: [''],
    costo_mano_obra: [0, [Validators.min(0)]],
    proximo_mantenimiento_km: this.fb.control<number | null>(null),
    proximo_mantenimiento_fecha: [''],
    estado: ['realizado' as EstadoMantenimiento, Validators.required],
    actualizar_kilometraje_vehiculo: [true]
  });

  readonly repuestoForm = this.fb.nonNullable.group({
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

    const sourceId = this.mantenimientoId ?? this.duplicateFromId;

    this.sub.add(
      forkJoin({
        vehiculos: this.api.get<VehiculoOption[]>('/vehiculos'),
        tipos: this.api.get<TipoMantenimientoOption[]>('/tipos-mantenimiento', { activo: true }),
        mantenimiento: sourceId ? this.api.get<MantenimientoRow>(`/mantenimientos/${sourceId}`) : of(null)
      }).subscribe({
        next: ({ vehiculos, tipos, mantenimiento }) => {
          this.vehiculos.set(vehiculos);
          this.tipos.set(tipos);

          if (mantenimiento) {
            this.fillForm(mantenimiento, { duplicate: this.duplicating });
          } else {
            this.applyCreatePrefill();
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
    void this.router.navigate(['/movil/mantenimientos']);
  }

  setCatalogInput(field: MantenimientoCatalogField, value: string) {
    this.catalogInput.update((current) => ({ ...current, [field]: value }));
    const match = this.catalogOptions(field).find((option) => option.label.toLowerCase() === value.trim().toLowerCase());
    this.form.controls[field].setValue(match?.value ?? '');

    if (!match) return;
    if (field === 'vehiculo_id') this.onVehiculoChanged();
    if (field === 'tipo_mantenimiento_id') this.recalculateProximoMantenimiento();
  }

  catalogInputValue(field: MantenimientoCatalogField) {
    return this.catalogInput()[field] ?? '';
  }

  catalogOptions(field: MantenimientoCatalogField): SelectOption[] {
    if (field === 'vehiculo_id') {
      return this.vehiculos().map((vehiculo) => ({
        value: vehiculo.id,
        label: [vehiculo.placa, vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' - ')
      }));
    }

    return this.tipos().map((tipo) => ({
      value: tipo.id,
      label: tipo.nombre
    }));
  }

  onVehiculoChanged() {
    const vehiculo = this.selectedVehiculo();
    if (!vehiculo) return;

    this.form.controls.kilometraje_actual_vehiculo.setValue(numberValue(vehiculo.kilometraje_actual), {
      emitEvent: false
    });
    this.recalculateProximoMantenimiento();
  }

  recalculateProximoMantenimiento() {
    const tipo = this.selectedTipo();
    if (!tipo) return;

    const kilometraje = numberValue(this.form.controls.kilometraje_actual_vehiculo.value);
    const fecha = this.form.controls.fecha_mantenimiento.value ?? '';

    if (tipo.intervalo_km) {
      this.form.controls.proximo_mantenimiento_km.setValue(kilometraje + Number(tipo.intervalo_km), {
        emitEvent: false
      });
    }

    if (tipo.intervalo_dias) {
      this.form.controls.proximo_mantenimiento_fecha.setValue(addDaysInputDate(fecha, Number(tipo.intervalo_dias)), {
        emitEvent: false
      });
    }
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
        nombre_repuesto: value.nombre_repuesto.trim(),
        cantidad,
        costo_unitario: costoUnitario,
        costo_total: roundMoney(cantidad * costoUnitario)
      }
    ]);
    this.repuestoForm.reset({
      nombre_repuesto: '',
      cantidad: 1,
      costo_unitario: 0
    });
  }

  removeRepuesto(index: number) {
    this.repuestos.update((current) => current.filter((_item, itemIndex) => itemIndex !== index));
  }

  save() {
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios.');
      return;
    }

    const payload = this.buildPayload();
    const request = this.mantenimientoId
      ? this.api.put<MantenimientoRow>(`/mantenimientos/${this.mantenimientoId}`, payload)
      : this.api.post<MantenimientoRow>('/mantenimientos', payload);

    this.saving.set(true);
    this.sub.add(
      request.subscribe({
        next: () => {
          this.saving.set(false);
          const returnUrl = this.returnUrl();
          if (returnUrl) {
            void this.router.navigateByUrl(returnUrl);
            return;
          }
          void this.router.navigate(['/movil/mantenimientos']);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo guardar el mantenimiento.');
        }
      })
    );
  }

  money(value: unknown) {
    return numberValue(value).toFixed(2);
  }

  repuestosTotal() {
    return roundMoney(this.repuestos().reduce((total, repuesto) => total + numberValue(repuesto.costo_total), 0));
  }

  totalMantenimiento() {
    return roundMoney(numberValue(this.form.controls.costo_mano_obra.value) + this.repuestosTotal());
  }

  repuestoFormTotal() {
    const value = this.repuestoForm.getRawValue();
    return roundMoney(numberValue(value.cantidad) * numberValue(value.costo_unitario));
  }

  private fillForm(row: MantenimientoRow, options: { duplicate?: boolean } = {}) {
    this.form.reset({
      vehiculo_id: String(row.vehiculo_id),
      tipo_mantenimiento_id: String(row.tipo_mantenimiento_id),
      fecha_mantenimiento: dateInputValue(row.fecha_mantenimiento),
      kilometraje_actual_vehiculo: numberValue(row.kilometraje_actual_vehiculo),
      descripcion: row.descripcion ?? '',
      costo_mano_obra: numberValue(row.costo_mano_obra),
      proximo_mantenimiento_km: nullableNumberValue(row.proximo_mantenimiento_km),
      proximo_mantenimiento_fecha: dateInputValue(row.proximo_mantenimiento_fecha),
      estado: options.duplicate ? 'realizado' : row.estado,
      actualizar_kilometraje_vehiculo: true
    });
    this.repuestos.set(
      (row.repuestos ?? []).map((repuesto) => ({
        nombre_repuesto: repuesto.nombre_repuesto,
        cantidad: numberValue(repuesto.cantidad),
        costo_unitario: numberValue(repuesto.costo_unitario),
        costo_total: roundMoney(numberValue(repuesto.cantidad) * numberValue(repuesto.costo_unitario))
      }))
    );
    this.syncCatalogInputs();
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
        cantidad: numberValue(repuesto.cantidad),
        costo_unitario: numberValue(repuesto.costo_unitario)
      }))
    };
  }

  private applyCreatePrefill() {
    const params = this.route.snapshot.queryParamMap;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const numberPattern = /^\d+(\.\d+)?$/;
    const patch: Partial<ReturnType<typeof this.form.getRawValue>> = {};

    const vehiculoId = params.get('vehiculo_id');
    const tipoMantenimientoId = params.get('tipo_mantenimiento_id');
    const fechaMantenimiento = params.get('fecha_mantenimiento');
    const costoTotal = params.get('costo_total');

    if (vehiculoId) patch.vehiculo_id = vehiculoId;
    if (tipoMantenimientoId) patch.tipo_mantenimiento_id = tipoMantenimientoId;
    if (fechaMantenimiento && datePattern.test(fechaMantenimiento)) patch.fecha_mantenimiento = fechaMantenimiento;
    if (costoTotal && numberPattern.test(costoTotal)) patch.costo_mano_obra = numberValue(costoTotal);

    if (Object.keys(patch).length === 0) return;

    this.form.patchValue(patch, { emitEvent: false });

    const vehiculo = this.selectedVehiculo();
    if (vehiculo) {
      this.form.controls.kilometraje_actual_vehiculo.setValue(numberValue(vehiculo.kilometraje_actual), {
        emitEvent: false
      });
    }

    this.recalculateProximoMantenimiento();
  }

  private syncCatalogInputs() {
    (['vehiculo_id', 'tipo_mantenimiento_id'] as MantenimientoCatalogField[]).forEach((field) => {
      const value = this.form.controls[field].value;
      const option = this.catalogOptions(field).find((item) => String(item.value) === String(value));
      this.catalogInput.update((current) => ({ ...current, [field]: option?.label ?? '' }));
    });
  }

  private selectedVehiculo() {
    const id = String(this.form.controls.vehiculo_id.value ?? '');
    return this.vehiculos().find((vehiculo) => String(vehiculo.id) === id) ?? null;
  }

  private selectedTipo() {
    const id = String(this.form.controls.tipo_mantenimiento_id.value ?? '');
    return this.tipos().find((tipo) => String(tipo.id) === id) ?? null;
  }

  private returnUrl() {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value?.startsWith('/movil/') ? value : null;
  }
}
