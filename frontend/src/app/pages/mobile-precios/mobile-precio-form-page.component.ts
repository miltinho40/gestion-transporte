import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideArrowLeft, LucideSave } from '@lucide/angular';
import { Subscription, forkJoin, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import {
  PrecioCatalogField,
  RutaOption,
  SelectOption,
  TarifaRutaRow,
  TipoCargaOption,
  dateInputValue,
  numberValue,
  todayInputDate,
  yearsFromTodayInputDate
} from './mobile-precios.types';

@Component({
  selector: 'app-mobile-precio-form-page',
  imports: [FormsModule, ReactiveFormsModule, LucideArrowLeft, LucideSave, AutoDismissAlertDirective],
  templateUrl: './mobile-precio-form-page.component.html',
  styleUrl: './mobile-precio-form-page.component.scss'
})
export class MobilePrecioFormPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sub = new Subscription();

  readonly tarifaId = this.route.snapshot.paramMap.get('id');
  readonly duplicateFromId = this.route.snapshot.queryParamMap.get('duplicateFrom');
  readonly editing = Boolean(this.tarifaId);
  readonly duplicating = !this.editing && Boolean(this.duplicateFromId);
  readonly rutas = signal<RutaOption[]>([]);
  readonly tiposCarga = signal<TipoCargaOption[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly catalogInput = signal<Record<PrecioCatalogField, string>>({
    ruta_id: '',
    tipo_carga_id: ''
  });

  readonly form = this.fb.nonNullable.group({
    ruta_id: ['', Validators.required],
    tipo_carga_id: ['', Validators.required],
    capacidad: [''],
    toneladas: this.fb.control<number | null>(null),
    precio: [0, [Validators.required, Validators.min(0.01)]],
    vigente_desde: [todayInputDate(), Validators.required],
    vigente_hasta: [yearsFromTodayInputDate(3)],
    activa: [true]
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
    const sourceId = this.tarifaId ?? this.duplicateFromId;

    this.sub.add(
      forkJoin({
        rutas: this.api.get<RutaOption[]>('/rutas', { activa: true }),
        tiposCarga: this.api.get<TipoCargaOption[]>('/tipos-carga', { activo: true }),
        tarifa: sourceId ? this.api.get<TarifaRutaRow>(`/tarifas-ruta/${sourceId}`) : of(null)
      }).subscribe({
        next: ({ rutas, tiposCarga, tarifa }) => {
          this.rutas.set(rutas);
          this.tiposCarga.set(tiposCarga);

          if (tarifa) {
            this.fillForm(tarifa, { duplicate: this.duplicating });
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
    void this.router.navigate(['/movil/precios']);
  }

  setCatalogInput(field: PrecioCatalogField, value: string) {
    this.catalogInput.update((current) => ({ ...current, [field]: value }));
    const match = this.catalogOptions(field).find((option) => option.label.toLowerCase() === value.trim().toLowerCase());
    this.form.controls[field].setValue(match?.value ?? '');
  }

  catalogInputValue(field: PrecioCatalogField) {
    return this.catalogInput()[field] ?? '';
  }

  catalogOptions(field: PrecioCatalogField): SelectOption[] {
    if (field === 'ruta_id') {
      return this.rutas().map((ruta) => ({
        value: ruta.id,
        label: `${ruta.origen} - ${ruta.destino}`
      }));
    }

    return this.tiposCarga().map((tipo) => ({
      value: tipo.id,
      label: tipo.nombre
    }));
  }

  save() {
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios.');
      return;
    }

    const payload = this.buildPayload();
    const request = this.tarifaId
      ? this.api.put<TarifaRutaRow>(`/tarifas-ruta/${this.tarifaId}`, payload)
      : this.api.post<TarifaRutaRow>('/tarifas-ruta', payload);

    this.saving.set(true);
    this.sub.add(
      request.subscribe({
        next: () => {
          this.saving.set(false);
          void this.router.navigate(['/movil/precios']);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo guardar el precio.');
        }
      })
    );
  }

  money(value: unknown) {
    return numberValue(value).toFixed(2);
  }

  private fillForm(row: TarifaRutaRow, options: { duplicate?: boolean } = {}) {
    this.form.reset({
      ruta_id: String(row.ruta_id),
      tipo_carga_id: String(row.tipo_carga_id),
      capacidad: row.capacidad ?? '',
      toneladas: row.toneladas === null || row.toneladas === undefined ? null : numberValue(row.toneladas),
      precio: numberValue(row.precio),
      vigente_desde: options.duplicate ? todayInputDate() : dateInputValue(row.vigente_desde),
      vigente_hasta: options.duplicate ? yearsFromTodayInputDate(3) : dateInputValue(row.vigente_hasta),
      activa: options.duplicate ? true : Boolean(row.activa)
    });
    this.syncCatalogInputs();
  }

  private buildPayload() {
    const value = this.form.getRawValue();

    return {
      ruta_id: value.ruta_id,
      tipo_carga_id: value.tipo_carga_id,
      capacidad: value.capacidad || null,
      toneladas: value.toneladas === null || value.toneladas === undefined || value.toneladas === 0 ? null : numberValue(value.toneladas),
      precio: numberValue(value.precio),
      vigente_desde: value.vigente_desde,
      vigente_hasta: value.vigente_hasta || null,
      activa: value.activa
    };
  }

  private syncCatalogInputs() {
    (['ruta_id', 'tipo_carga_id'] as PrecioCatalogField[]).forEach((field) => {
      const value = this.form.controls[field].value;
      const option = this.catalogOptions(field).find((item) => String(item.value) === String(value));
      this.catalogInput.update((current) => ({ ...current, [field]: option?.label ?? '' }));
    });
  }
}
