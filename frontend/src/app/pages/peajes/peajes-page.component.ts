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

interface CategoriaPeajeOption {
  id: string;
  propietario_id?: string | null;
  nombre: string;
  numero_ejes?: number | null;
}

interface TarifaPeajeItem {
  categoria_peaje_id: string;
  categoria_nombre: string;
  valor: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  activa: boolean;
}

interface PeajeRow {
  id: string;
  propietario_id?: string | null;
  nombre: string;
  ubicacion?: string | null;
  activo: boolean;
  tarifas_peaje?: Array<{
    categoria_peaje_id: string;
    valor: string | number;
    vigente_desde: string;
    vigente_hasta?: string | null;
    activa: boolean;
    categoria_peaje?: CategoriaPeajeOption;
  }>;
}

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const todayInputDate = () => toDateInputValue(new Date());

@Component({
  selector: 'app-peajes-page',
  imports: [
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
  templateUrl: './peajes-page.component.html'
})
export class PeajesPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly sub = new Subscription();

  readonly rows = signal<PeajeRow[]>([]);
  readonly categoriasCatalogo = signal<CategoriaPeajeOption[]>([]);
  readonly tarifas = signal<TarifaPeajeItem[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editingRow = signal<PeajeRow | null>(null);
  readonly editingTarifaIndex = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly search = signal('');
  readonly categoriaSearch = signal('');
  readonly categoriaCatalogOpen = signal(false);
  readonly selectedCategoriaId = signal('');

  readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    ubicacion: [''],
    activo: [true],
    global: [true]
  });

  readonly tarifaForm = this.fb.nonNullable.group({
    valor: [0, [Validators.min(0)]],
    vigente_desde: [todayInputDate()],
    vigente_hasta: [''],
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

    this.sub.add(
      forkJoin({
        peajes: this.api.get<PeajeRow[]>('/peajes'),
        categorias: this.api.get<CategoriaPeajeOption[]>('/categorias-peaje/catalogo', {
          activo: true
        })
      }).subscribe({
        next: ({ peajes, categorias }) => {
          this.rows.set(peajes);
          this.categoriasCatalogo.set(categorias);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los peajes.');
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

  filteredCategorias() {
    const term = this.categoriaSearch().trim().toLowerCase();

    return this.categoriasCatalogo()
      .filter((categoria) => {
        if (!term) return true;
        return categoria.nombre.toLowerCase().includes(term);
      })
      .slice(0, 30);
  }

  openCreate() {
    this.editingRow.set(null);
    this.form.reset({
      nombre: '',
      ubicacion: '',
      activo: true,
      global: true
    });
    this.resetTarifaForm();
    this.tarifas.set([]);
    this.formOpen.set(true);
    this.error.set(null);
    this.message.set(null);
  }

  openEdit(row: PeajeRow) {
    this.editingRow.set(row);
    this.form.reset({
      nombre: row.nombre,
      ubicacion: row.ubicacion ?? '',
      activo: Boolean(row.activo),
      global: row.propietario_id === null
    });
    this.tarifas.set(
      (row.tarifas_peaje ?? []).map((item) => ({
        categoria_peaje_id: String(item.categoria_peaje_id),
        categoria_nombre: item.categoria_peaje?.nombre ?? `Categoría ${item.categoria_peaje_id}`,
        valor: Number(item.valor ?? 0),
        vigente_desde: String(item.vigente_desde).slice(0, 10),
        vigente_hasta: item.vigente_hasta ? String(item.vigente_hasta).slice(0, 10) : null,
        activa: Boolean(item.activa)
      }))
    );
    this.resetTarifaForm();
    this.formOpen.set(true);
    this.error.set(null);
    this.message.set(null);
  }

  closeForm() {
    this.formOpen.set(false);
    this.editingRow.set(null);
    this.saving.set(false);
    this.error.set(null);
  }

  resetTarifaForm() {
    this.tarifaForm.reset({
      valor: 0,
      vigente_desde: todayInputDate(),
      vigente_hasta: '',
      activa: true
    });
    this.categoriaSearch.set('');
    this.categoriaCatalogOpen.set(false);
    this.selectedCategoriaId.set('');
    this.editingTarifaIndex.set(null);
  }

  openCategoriaCatalog() {
    this.categoriaCatalogOpen.set(true);
  }

  closeCategoriaCatalogSoon() {
    window.setTimeout(() => this.categoriaCatalogOpen.set(false), 150);
  }

  setCategoriaSearch(value: string) {
    this.categoriaSearch.set(value);
    const term = value.trim().toLowerCase();
    const exactMatch = this.filteredCategorias().find((categoria) => categoria.nombre.toLowerCase() === term);
    this.selectedCategoriaId.set(exactMatch?.id ?? '');
    this.categoriaCatalogOpen.set(true);
  }

  selectCategoria(categoria: CategoriaPeajeOption, event?: MouseEvent) {
    event?.preventDefault();
    this.selectedCategoriaId.set(categoria.id);
    this.categoriaSearch.set(categoria.nombre);
    this.categoriaCatalogOpen.set(false);
  }

  addOrUpdateTarifa() {
    const search = this.categoriaSearch().trim().toLowerCase();
    const categoriaId = this.selectedCategoriaId();
    const categoria =
      this.categoriasCatalogo().find((item) => item.id === categoriaId) ??
      this.filteredCategorias().find((item) => item.nombre.toLowerCase() === search);
    if (!categoria || this.tarifaForm.invalid) {
      this.tarifaForm.markAllAsTouched();
      return;
    }

    const value = this.tarifaForm.getRawValue();
    const tarifa: TarifaPeajeItem = {
      categoria_peaje_id: categoria.id,
      categoria_nombre: categoria.nombre,
      valor: Number(value.valor ?? 0),
      vigente_desde: value.vigente_desde || todayInputDate(),
      vigente_hasta: value.vigente_hasta || null,
      activa: value.activa
    };
    const editingIndex = this.editingTarifaIndex();

    this.tarifas.update((current) => {
      if (editingIndex === null) return [...current, tarifa];
      return current.map((item, index) => (index === editingIndex ? tarifa : item));
    });
    this.resetTarifaForm();
  }

  editTarifa(index: number) {
    const tarifa = this.tarifas()[index];
    if (!tarifa) return;

    this.editingTarifaIndex.set(index);
    this.selectedCategoriaId.set(tarifa.categoria_peaje_id);
    this.categoriaSearch.set(tarifa.categoria_nombre);
    this.tarifaForm.reset({
      valor: tarifa.valor,
      vigente_desde: tarifa.vigente_desde,
      vigente_hasta: tarifa.vigente_hasta ?? '',
      activa: tarifa.activa
    });
  }

  removeTarifa(index: number) {
    this.tarifas.update((current) => current.filter((_item, itemIndex) => itemIndex !== index));
    if (this.editingTarifaIndex() === index) this.resetTarifaForm();
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      nombre: value.nombre,
      ubicacion: value.ubicacion || null,
      activo: value.activo,
      global: value.global,
      tarifas: this.tarifas().map((item) => ({
        categoria_peaje_id: item.categoria_peaje_id,
        valor: item.valor,
        vigente_desde: item.vigente_desde,
        vigente_hasta: item.vigente_hasta,
        activa: item.activa
      }))
    };

    const row = this.editingRow();
    const request = row
      ? this.api.put<PeajeRow>(`/peajes/${row.id}`, payload)
      : this.api.post<PeajeRow>('/peajes', payload);

    this.saving.set(true);
    this.error.set(null);

    this.sub.add(
      request.subscribe({
        next: () => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.message.set(row ? 'Peaje actualizado.' : 'Peaje creado.');
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo guardar el peaje.');
        }
      })
    );
  }

  delete(row: PeajeRow) {
    if (!confirm(`Eliminar o desactivar ${row.nombre}?`)) return;

    this.deletingId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api.delete<PeajeRow>(`/peajes/${row.id}`).subscribe({
        next: () => {
          this.deletingId.set(null);
          this.message.set('Peaje desactivado.');
          this.load();
        },
        error: (err) => {
          this.deletingId.set(null);
          this.error.set(err?.error?.message ?? 'No se pudo desactivar el peaje.');
        }
      })
    );
  }

  tarifasLabel(row: PeajeRow) {
    const count = row.tarifas_peaje?.length ?? 0;
    return count ? `${count} tarifas` : 'Sin tarifas';
  }
}
