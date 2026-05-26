import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSave,
  LucideSearch,
  LucideTrash2,
  LucideX
} from '@lucide/angular';
import { forkJoin, Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import type { ApiListColumn, CrudFieldConfig, CrudRouteData, SelectOption } from '../../core/models';

type Row = Record<string, unknown>;
type FormValue = string | number | boolean | null;
type CrudForm = FormGroup<Record<string, FormControl<FormValue>>>;

const toHoursTime = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '';

  const decimalHours = Number(value);
  if (!Number.isFinite(decimalHours) || decimalHours < 0) return '';

  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const fromHoursTime = (value: unknown) => {
  const text = String(value ?? '').trim();
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(text);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return Number((hours + minutes / 60).toFixed(4));
};

const setPayloadValue = (payload: Row, field: CrudFieldConfig, value: unknown) => {
  const path = field.payloadPath ?? field.name;
  const parts = path.split('.');
  let current = payload;

  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }

    current = current[part] as Row;
  }

  current[parts[parts.length - 1] ?? field.name] = value;
};

@Component({
  selector: 'app-crud-page',
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
  templateUrl: './crud-page.component.html'
})
export class CrudPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly sub = new Subscription();
  private formSyncSub = new Subscription();

  readonly config = signal<CrudRouteData | null>(null);
  readonly rows = signal<Row[]>([]);
  readonly catalogOptions = signal<Record<string, SelectOption[]>>({});
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editingRow = signal<Row | null>(null);
  readonly catalogInput = signal<Record<string, string>>({});
  readonly activeCatalogField = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly search = signal('');

  form: CrudForm = new FormGroup<Record<string, FormControl<FormValue>>>({});

  constructor() {
    this.sub.add(
      this.route.data.subscribe((data) => {
        const config = data as CrudRouteData;
        this.config.set(config);
        this.search.set('');
        this.message.set(null);
        this.error.set(null);
        this.formOpen.set(false);
        this.editingRow.set(null);
        this.buildForm(config);
        this.loadCatalogs(config);
        this.load();
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    this.formSyncSub.unsubscribe();
  }

  load() {
    const config = this.config();
    if (!config) return;

    this.loading.set(true);
    this.error.set(null);

    this.api.get<Row[]>(config.endpoint).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron cargar los datos.');
        this.loading.set(false);
      }
    });
  }

  openCreate() {
    const config = this.config();
    if (!config) return;

    this.editingRow.set(null);
    this.buildForm(config);
    this.syncCatalogInputs(config.fields);
    this.formOpen.set(true);
    this.message.set(null);
    this.error.set(null);
  }

  openEdit(row: Row) {
    const config = this.config();
    if (!config) return;

    this.editingRow.set(row);
    this.buildForm(config, row);
    this.syncCatalogInputs(config.fields);
    this.formOpen.set(true);
    this.message.set(null);
    this.error.set(null);
  }

  closeForm() {
    this.formOpen.set(false);
    this.editingRow.set(null);
    this.catalogInput.set({});
    this.activeCatalogField.set(null);
    this.error.set(null);
    this.saving.set(false);
  }

  save() {
    const config = this.config();
    if (!config) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const row = this.editingRow();
    const payload = this.buildPayload(config.fields);
    const request = row
      ? this.api.put<Row>(`${config.endpoint}/${this.idOf(row)}`, payload)
      : this.api.post<Row>(config.endpoint, payload);

    this.saving.set(true);
    this.error.set(null);

    request.subscribe({
      next: (response) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.editingRow.set(null);
        this.message.set(this.successMessage(row, response));
        this.load();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo guardar el registro.');
        this.saving.set(false);
      }
    });
  }

  delete(row: Row) {
    const config = this.config();
    if (!config) return;

    const name = this.textValue(row, { label: '', path: config.displayField });
    if (!confirm(`Eliminar o desactivar ${name}?`)) return;

    const id = this.idOf(row);
    this.deletingId.set(id);
    this.error.set(null);
    this.message.set(null);

    this.api.delete<Row>(`${config.endpoint}/${id}`).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.message.set('Registro eliminado o desactivado.');
        this.load();
      },
      error: (err) => {
        this.deletingId.set(null);
        this.error.set(err?.error?.message ?? 'No se pudo desactivar el registro.');
      }
    });
  }

  filteredRows() {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.rows();

    return this.rows().filter((row) => JSON.stringify(row).toLowerCase().includes(term));
  }

  visibleFields(fields: CrudFieldConfig[]) {
    const editing = Boolean(this.editingRow());

    return fields.filter((field) => !(editing && field.createOnly));
  }

  value(row: Row, path: string) {
    return path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return null;
      return (current as Row)[key];
    }, row);
  }

  textValue(row: Row, column: ApiListColumn) {
    const value = this.value(row, column.path);
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);

    return String(value);
  }

  dateValue(row: Row, path: string) {
    return this.value(row, path) as string | number | Date | null | undefined;
  }

  hoursTimeValue(row: Row, path: string) {
    return toHoursTime(this.value(row, path)) || '-';
  }

  optionsFor(field: CrudFieldConfig) {
    return field.options ?? this.catalogOptions()[field.name] ?? [];
  }

  filteredOptionsFor(field: CrudFieldConfig) {
    const options = this.optionsFor(field);
    const term = (this.catalogInput()[field.name] ?? '').trim().toLowerCase();
    if (!term) return options;

    return options.filter((option) => option.label.toLowerCase().includes(term));
  }

  limitedFilteredOptionsFor(field: CrudFieldConfig) {
    return this.filteredOptionsFor(field).slice(0, 30);
  }

  catalogInputValue(fieldName: string) {
    return this.catalogInput()[fieldName] ?? '';
  }

  setCatalogInput(field: CrudFieldConfig, value: string) {
    this.catalogInput.update((current) => ({
      ...current,
      [field.name]: value
    }));

    const match = this.optionsFor(field).find(
      (option) => option.label.toLowerCase() === value.trim().toLowerCase()
    );
    const control = this.form.controls[field.name];
    control?.setValue(match ? match.value : '', { emitEvent: false });
    control?.markAsDirty();
    this.activeCatalogField.set(field.name);
  }

  selectCatalogOption(field: CrudFieldConfig, option: SelectOption, event?: MouseEvent) {
    event?.preventDefault();
    const control = this.form.controls[field.name];
    control?.setValue(option.value, { emitEvent: false });
    control?.markAsDirty();
    control?.markAsTouched();

    this.catalogInput.update((current) => ({
      ...current,
      [field.name]: option.label
    }));
    this.activeCatalogField.set(null);
  }

  openCatalog(fieldName: string) {
    this.activeCatalogField.set(fieldName);
  }

  closeCatalogSoon(fieldName: string) {
    const control = this.form.controls[fieldName];
    control?.markAsTouched();

    window.setTimeout(() => {
      if (this.activeCatalogField() === fieldName) {
        this.activeCatalogField.set(null);
      }
    }, 150);
  }

  catalogOpen(field: CrudFieldConfig) {
    return this.activeCatalogField() === field.name;
  }

  catalogSelected(field: CrudFieldConfig) {
    return Boolean(this.form.controls[field.name]?.value);
  }

  controlInvalid(name: string) {
    const control = this.form.controls[name];
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  badgeClass(value: unknown) {
    const text = String(value ?? '').toLowerCase();
    if (text.includes('venc') || text.includes('cancel') || text.includes('inactivo')) {
      return 'badge-soft-danger';
    }
    if (text.includes('curso') || text.includes('mantenimiento') || text.includes('program')) {
      return 'badge-soft-warning';
    }
    return 'badge-soft';
  }

  idOf(row: Row) {
    return String(row['id']);
  }

  private buildForm(config: CrudRouteData, row?: Row) {
    this.formSyncSub.unsubscribe();
    this.formSyncSub = new Subscription();

    const controls: Record<string, FormControl<FormValue>> = {};

    for (const field of config.fields) {
      const validators = [];
      if (field.required && field.type !== 'checkbox' && !(row && field.createOnly)) {
        validators.push(Validators.required);
      }
      if (field.type === 'email') validators.push(Validators.email);
      if (typeof field.min === 'number') validators.push(Validators.min(field.min));
      if (typeof field.max === 'number') validators.push(Validators.max(field.max));

      controls[field.name] = new FormControl<FormValue>(this.initialValue(field, row), {
        validators
      });
    }

    this.form = new FormGroup<Record<string, FormControl<FormValue>>>(controls);
    this.setupFieldSync(config.fields, row);
  }

  private initialValue(field: CrudFieldConfig, row?: Row): FormValue {
    if (row) {
      const value = this.value(row, field.name);
      if (field.parseAs === 'stringArray' && Array.isArray(value)) return value.join('\n');
      if (field.parseAs === 'hoursTime') return toHoursTime(value);
      if (field.type === 'date' && typeof value === 'string') return value.slice(0, 10);
      if (field.type === 'checkbox') return Boolean(value);
      if (field.type === 'select') return value === null || value === undefined ? '' : String(value);
      return (value as FormValue) ?? '';
    }

    if (field.defaultValue !== undefined) {
      return typeof field.defaultValue === 'function' ? field.defaultValue() : field.defaultValue;
    }
    if (field.type === 'checkbox') return false;
    if (field.type === 'select' && field.catalog) return '';
    if (field.type === 'select') return this.optionsFor(field)[0]?.value ?? '';
    return '';
  }

  private buildPayload(fields: CrudFieldConfig[]) {
    const payload: Row = {};
    const isEdit = Boolean(this.editingRow());

    for (const field of fields) {
      if (isEdit && field.createOnly) continue;

      const raw = this.form.controls[field.name]?.value;

      if (field.parseAs === 'stringArray') {
        if (raw === '' || raw === null || raw === undefined) {
          if (!field.omitWhenEmpty) setPayloadValue(payload, field, []);
          continue;
        }

        setPayloadValue(
          payload,
          field,
          String(raw)
            .split(/[\n,;]+/)
            .map((item) => item.trim())
            .filter(Boolean)
        );
        continue;
      }

      if (field.parseAs === 'hoursTime') {
        const parsed = fromHoursTime(raw);
        if (parsed === null) {
          if (field.omitWhenEmpty) continue;
          setPayloadValue(payload, field, field.required ? raw : null);
          continue;
        }

        setPayloadValue(payload, field, parsed);
        continue;
      }

      if (field.type === 'checkbox') {
        setPayloadValue(payload, field, Boolean(raw));
        continue;
      }

      if (raw === '' || raw === null || raw === undefined) {
        if (field.omitWhenEmpty) continue;
        setPayloadValue(payload, field, field.required ? raw : null);
        continue;
      }

      setPayloadValue(payload, field, field.type === 'number' ? Number(raw) : raw);
    }

    return payload;
  }

  private successMessage(row: Row | null, response: unknown) {
    if (row) return 'Registro actualizado.';

    const invitacion = (response as Row | null)?.['invitacion'] as Row | null | undefined;
    const enlace = invitacion?.['enlace'];
    if (typeof enlace === 'string') {
      const estadoCorreo = invitacion?.['email_enviado']
        ? ' La invitación fue enviada por correo.'
        : ' SMTP no esta configurado; usa este enlace para probar.';

      return `Registro creado.${estadoCorreo} Enlace: ${enlace}`;
    }

    return 'Registro creado.';
  }

  private loadCatalogs(config: CrudRouteData) {
    const catalogFields = config.fields.filter((field) => field.catalog);

    if (!catalogFields.length) {
      this.catalogOptions.set({});
      return;
    }

    forkJoin(
      catalogFields.map((field) => this.api.get<Row[]>(field.catalog!.endpoint, field.catalog!.params))
    ).subscribe({
      next: (responses) => {
        const options: Record<string, SelectOption[]> = {};

        for (const [index, field] of catalogFields.entries()) {
          const catalog = field.catalog!;
          options[field.name] = responses[index].map((item) => {
            const label = catalog.labelPaths?.length
              ? catalog.labelPaths
                  .map((path) => String(this.value(item, path) ?? ''))
                  .filter(Boolean)
                  .join(catalog.labelSeparator ?? ' - ')
              : String(this.value(item, catalog.labelPath) ?? '');

            return {
              value: String(this.value(item, catalog.valuePath) ?? ''),
              label
            };
          });
        }

        this.catalogOptions.set(options);
        this.syncCatalogInputs(config.fields);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron cargar los catálogos.');
      }
    });
  }

  private syncCatalogInputs(fields: CrudFieldConfig[]) {
    const next: Record<string, string> = {};

    for (const field of fields.filter((item) => item.catalog)) {
      const value = this.form.controls[field.name]?.value;
      const option = this.optionsFor(field).find((item) => String(item.value) === String(value));
      next[field.name] = option?.label ?? '';
    }

    this.catalogInput.set(next);
  }

  private setupFieldSync(fields: CrudFieldConfig[], row?: Row) {
    if (row) return;

    for (const field of fields.filter((item) => item.syncFrom)) {
      const source = this.form.controls[field.syncFrom!];
      const target = this.form.controls[field.name];
      if (!source || !target) continue;

      const syncValue = (value: FormValue) => {
        if (target.dirty) return;
        target.setValue((value ?? '') as FormValue, { emitEvent: false });
      };

      syncValue(source.value);
      this.formSyncSub.add(source.valueChanges.subscribe(syncValue));
    }
  }
}
