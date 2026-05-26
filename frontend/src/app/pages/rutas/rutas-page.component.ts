import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideArrowDown,
  LucideArrowUp,
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
import { AuthService } from '../../core/auth.service';

type SentidoPeaje = 'ida' | 'retorno' | 'ambos';

interface PeajeOption {
  id: string;
  propietario_id?: string | null;
  nombre: string;
  ubicacion?: string | null;
}

interface RutaPeajeItem {
  peaje_id: string;
  peaje_propietario_id?: string | null;
  peaje_nombre: string;
  orden: number;
  sentido: SentidoPeaje;
}

interface RutaRow {
  id: string;
  propietario_id?: string | null;
  origen: string;
  destino: string;
  distancia_km: string | number;
  duracion_estimada_horas?: string | number | null;
  activa: boolean;
  rutas_peajes?: Array<{
    peaje_id: string;
    orden?: number | null;
    sentido: SentidoPeaje;
    peaje?: PeajeOption;
  }>;
}

const toHoursTime = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '';
  const decimalHours = Number(value);
  if (!Number.isFinite(decimalHours) || decimalHours < 0) return '';

  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const fromHoursTime = (value: string) => {
  if (!value) return null;
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value);
  if (!match) return null;

  return Number((Number(match[1]) + Number(match[2]) / 60).toFixed(4));
};

const normalizeSentido = (value?: string | null): SentidoPeaje => {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'ida' || normalized === 'retorno' || normalized === 'ambos') return normalized;
  return 'ambos';
};

@Component({
  selector: 'app-rutas-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    LucideArrowDown,
    LucideArrowUp,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSave,
    LucideSearch,
    LucideTrash2,
    LucideX
  ],
  templateUrl: './rutas-page.component.html'
})
export class RutasPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly sub = new Subscription();

  readonly rows = signal<RutaRow[]>([]);
  readonly peajesCatalogo = signal<PeajeOption[]>([]);
  readonly peajesRuta = signal<RutaPeajeItem[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editingRow = signal<RutaRow | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly search = signal('');
  readonly peajeSearch = signal('');
  readonly peajeCatalogOpen = signal(false);
  readonly selectedPeajeId = signal('');

  readonly isSuperAdmin = this.auth.usuario()?.es_super_admin === true;

  readonly form = this.fb.nonNullable.group({
    origen: ['', Validators.required],
    destino: ['', Validators.required],
    distancia_km: [0, [Validators.min(0)]],
    duracion_estimada_horas: [''],
    activa: [true],
    global: [false]
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
        rutas: this.api.get<RutaRow[]>('/rutas'),
        peajes: this.api.get<PeajeOption[]>('/peajes/catalogo', { activo: true })
      }).subscribe({
        next: ({ rutas, peajes }) => {
          this.rows.set(rutas);
          this.peajesCatalogo.set(peajes);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar las rutas.');
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

  filteredPeajes() {
    const usedIds = new Set(this.peajesRuta().map((item) => item.peaje_id));
    const term = this.peajeSearch().trim().toLowerCase();
    const routeIsGlobal = this.currentRouteIsGlobal();
    const routeOwnerId = this.currentRouteOwnerId();

    return this.peajesCatalogo()
      .filter((peaje) => !usedIds.has(peaje.id))
      .filter((peaje) => {
        if (this.isSuperAdmin && routeIsGlobal) return true;
        if (!routeOwnerId) return !peaje.propietario_id || this.isSuperAdmin;
        return !peaje.propietario_id || peaje.propietario_id === routeOwnerId;
      })
      .filter((peaje) => {
        if (!term) return true;
        return `${peaje.nombre} ${peaje.ubicacion ?? ''}`.toLowerCase().includes(term);
      })
      .slice(0, 30);
  }

  openCreate() {
    this.editingRow.set(null);
    this.form.reset({
      origen: '',
      destino: '',
      distancia_km: 0,
      duracion_estimada_horas: '',
      activa: true,
      global: false
    });
    this.peajesRuta.set([]);
    this.peajeSearch.set('');
    this.peajeCatalogOpen.set(false);
    this.selectedPeajeId.set('');
    this.formOpen.set(true);
    this.error.set(null);
    this.message.set(null);
  }

  openEdit(row: RutaRow) {
    this.editingRow.set(row);
    this.form.reset({
      origen: row.origen,
      destino: row.destino,
      distancia_km: Number(row.distancia_km ?? 0),
      duracion_estimada_horas: toHoursTime(row.duracion_estimada_horas),
      activa: Boolean(row.activa),
      global: row.propietario_id === null
    });
    this.peajesRuta.set(
      (row.rutas_peajes ?? []).map((item, index) => ({
        peaje_id: String(item.peaje_id),
        peaje_propietario_id: item.peaje?.propietario_id ?? null,
        peaje_nombre: item.peaje?.nombre ?? `Peaje ${item.peaje_id}`,
        orden: item.orden ?? index + 1,
        sentido: normalizeSentido(item.sentido)
      }))
    );
    this.peajeSearch.set('');
    this.peajeCatalogOpen.set(false);
    this.selectedPeajeId.set('');
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

  openPeajeCatalog() {
    this.peajeCatalogOpen.set(true);
  }

  closePeajeCatalogSoon() {
    window.setTimeout(() => this.peajeCatalogOpen.set(false), 150);
  }

  setPeajeSearch(value: string) {
    this.peajeSearch.set(value);
    const term = value.trim().toLowerCase();
    const exactMatch = this.filteredPeajes().find((peaje) => peaje.nombre.toLowerCase() === term);
    this.selectedPeajeId.set(exactMatch?.id ?? '');
    this.peajeCatalogOpen.set(true);
  }

  selectPeaje(peaje: PeajeOption, event?: MouseEvent) {
    event?.preventDefault();
    this.selectedPeajeId.set(peaje.id);
    this.peajeSearch.set(peaje.nombre);
    this.peajeCatalogOpen.set(false);
  }

  addPeaje() {
    const search = this.peajeSearch().trim().toLowerCase();
    const peajeId = this.selectedPeajeId();
    const peaje =
      this.peajesCatalogo().find((item) => item.id === peajeId) ??
      this.filteredPeajes().find((item) => item.nombre.toLowerCase() === search);
    if (!peaje) return;

    this.peajesRuta.update((current) => [
      ...current,
      {
        peaje_id: peaje.id,
        peaje_propietario_id: peaje.propietario_id ?? null,
        peaje_nombre: peaje.nombre,
        orden: current.length + 1,
        sentido: 'ambos'
      }
    ]);
    this.peajeSearch.set('');
    this.peajeCatalogOpen.set(false);
    this.selectedPeajeId.set('');
  }

  removePeaje(index: number) {
    this.peajesRuta.update((current) =>
      current.filter((_item, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({
        ...item,
        orden: itemIndex + 1
      }))
    );
  }

  movePeaje(index: number, direction: -1 | 1) {
    const next = [...this.peajesRuta()];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target]!, next[index]!];
    this.peajesRuta.set(next.map((item, itemIndex) => ({ ...item, orden: itemIndex + 1 })));
  }

  updatePeaje(index: number, patch: Partial<RutaPeajeItem>) {
    this.peajesRuta.update((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      origen: value.origen,
      destino: value.destino,
      distancia_km: Number(value.distancia_km ?? 0),
      duracion_estimada_horas: fromHoursTime(value.duracion_estimada_horas),
      activa: value.activa,
      global: this.isSuperAdmin ? value.global : undefined,
      peajes: this.peajesRuta().map((item, index) => ({
        peaje_id: item.peaje_id,
        orden: item.orden || index + 1,
        sentido: item.sentido
      }))
    };

    const row = this.editingRow();
    const request = row
      ? this.api.put<RutaRow>(`/rutas/${row.id}`, payload)
      : this.api.post<RutaRow>('/rutas', payload);

    this.saving.set(true);
    this.error.set(null);

    this.sub.add(
      request.subscribe({
        next: () => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.message.set(row ? 'Ruta actualizada.' : 'Ruta creada.');
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo guardar la ruta.');
        }
      })
    );
  }

  delete(row: RutaRow) {
    if (!confirm(`Eliminar o desactivar ${row.origen} - ${row.destino}?`)) return;

    this.deletingId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api.delete<RutaRow>(`/rutas/${row.id}`).subscribe({
        next: () => {
          this.deletingId.set(null);
          this.message.set('Ruta desactivada.');
          this.load();
        },
        error: (err) => {
          this.deletingId.set(null);
          this.error.set(err?.error?.message ?? 'No se pudo desactivar la ruta.');
        }
      })
    );
  }

  duration(row: RutaRow) {
    return toHoursTime(row.duracion_estimada_horas) || '-';
  }

  peajesLabel(row: RutaRow) {
    const count = row.rutas_peajes?.length ?? 0;
    return count ? `${count} peajes` : 'Sin peajes';
  }

  currentRouteIsGlobal() {
    const row = this.editingRow();
    return row ? row.propietario_id === null : this.isSuperAdmin && this.form.controls.global.value;
  }

  currentRouteOwnerId() {
    const row = this.editingRow();
    if (row) return row.propietario_id ?? null;
    return this.currentRouteIsGlobal() ? null : this.auth.contexto()?.propietario_id ?? null;
  }

  canEditRuta(row: RutaRow) {
    return this.isSuperAdmin || row.propietario_id !== null;
  }
}
