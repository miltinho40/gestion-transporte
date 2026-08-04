import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideCheck,
  LucideMessageSquare,
  LucideRefreshCw,
  LucideRotateCcw,
  LucideSearch,
  LucideX
} from '@lucide/angular';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import type { PaginatedResponse, PaginationMeta } from '../../core/pagination';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';

type AssistantRating = 'correcta' | 'incorrecta';
type ReviewState = 'pendiente' | 'revisada' | 'descartada';

interface AssistantEvaluationRow {
  id: string;
  calificacion: AssistantRating;
  correccion?: string | null;
  estado_revision: ReviewState;
  mensaje_usuario?: string | null;
  respuesta_asistente?: string | null;
  herramienta?: string | null;
  proveedor?: string | null;
  modelo?: string | null;
  confianza?: number | null;
  duracion_ms?: number | null;
  tokens_total?: number | null;
  created_at: string;
  propietario: { id: string; nombre: string };
  usuario: { id: string; nombre: string; email: string };
  revisado_por?: { id: string; nombre: string } | null;
  conversacion: { canal: string };
  ejemplo?: { id: string; activo: boolean; herramienta_esperada: string } | null;
}

interface AssistantEvaluationSummary {
  total: number;
  correctas: number;
  incorrectas: number;
  porcentaje_correctas: number;
  pendientes_revision: number;
  duracion_promedio_ms: number;
  tokens_entrada: number;
  tokens_salida: number;
  tokens_total: number;
  costo_estimado_usd: number | null;
  tarifa_costo_configurada: boolean;
  ejemplos_activos: number;
  casos_dinamicos_correctos: number;
  porcentaje_casos_dinamicos: number;
}

interface AssistantEvaluationResponse extends PaginatedResponse<AssistantEvaluationRow> {
  resumen: AssistantEvaluationSummary;
}

@Component({
  selector: 'app-asistente-evaluaciones-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    LucideCheck,
    LucideMessageSquare,
    LucideRefreshCw,
    LucideRotateCcw,
    LucideSearch,
    LucideX,
    PaginationControlsComponent
  ],
  templateUrl: './asistente-evaluaciones-page.component.html',
  styleUrl: './asistente-evaluaciones-page.component.scss'
})
export class AsistenteEvaluacionesPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly subscriptions = new Subscription();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  readonly rows = signal<AssistantEvaluationRow[]>([]);
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly summary = signal<AssistantEvaluationSummary>({
    total: 0,
    correctas: 0,
    incorrectas: 0,
    porcentaje_correctas: 0,
    pendientes_revision: 0,
    duracion_promedio_ms: 0,
    tokens_entrada: 0,
    tokens_salida: 0,
    tokens_total: 0,
    costo_estimado_usd: null,
    tarifa_costo_configurada: false,
    ejemplos_activos: 0,
    casos_dinamicos_correctos: 0,
    porcentaje_casos_dinamicos: 0
  });
  readonly loading = signal(false);
  readonly reviewingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly search = signal('');
  readonly rating = signal('todas');
  readonly reviewState = signal('todos');
  readonly from = signal('');
  readonly to = signal('');
  readonly page = signal(1);
  readonly limit = signal(25);

  constructor() {
    this.load();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.subscriptions.add(
      this.api
        .get<AssistantEvaluationResponse>('/asistente/evaluaciones', {
          page: this.page(),
          limit: this.limit(),
          search: this.search().trim() || undefined,
          calificacion: this.rating() === 'todas' ? undefined : this.rating(),
          estado: this.reviewState() === 'todos' ? undefined : this.reviewState(),
          desde: this.from() || undefined,
          hasta: this.to() || undefined
        })
        .subscribe({
          next: (response) => {
            this.rows.set(response.data);
            this.pagination.set(response.meta);
            this.summary.set(response.resumen);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(err?.error?.message ?? 'No se pudieron cargar las evaluaciones.');
            this.loading.set(false);
          }
        })
    );
  }

  setSearch(value: string) {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 350);
  }

  applyFilters() {
    this.page.set(1);
    this.load();
  }

  clearFilters() {
    this.search.set('');
    this.rating.set('todas');
    this.reviewState.set('todos');
    this.from.set('');
    this.to.set('');
    this.page.set(1);
    this.load();
  }

  hasActiveFilters() {
    return Boolean(
      this.search().trim() ||
      this.rating() !== 'todas' ||
      this.reviewState() !== 'todos' ||
      this.from() ||
      this.to()
    );
  }

  changePage(page: number) {
    const meta = this.pagination();
    if (!meta || page < 1 || page > meta.total_pages || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  changeLimit(limit: number) {
    if (limit === this.limit()) return;
    this.limit.set(Number(limit));
    this.page.set(1);
    this.load();
  }

  review(row: AssistantEvaluationRow, state: ReviewState) {
    if (this.reviewingId()) return;
    this.reviewingId.set(row.id);
    this.error.set(null);
    this.subscriptions.add(
      this.api
        .patch<AssistantEvaluationRow>(`/asistente/evaluaciones/${row.id}/revision`, {
          estado: state
        })
        .subscribe({
          next: (updated) => {
            this.reviewingId.set(null);
            this.showNotice(
              state === 'revisada'
                ? updated.ejemplo?.activo
                  ? 'Evaluación revisada y agregada como ejemplo controlado.'
                  : 'Evaluación revisada. No tiene una corrección utilizable como ejemplo.'
                : state === 'descartada'
                  ? 'Evaluación descartada.'
                  : 'Evaluación devuelta a pendientes.'
            );
            this.load();
          },
          error: (err) => {
            this.reviewingId.set(null);
            this.error.set(err?.error?.message ?? 'No se pudo actualizar la evaluación.');
          }
        })
    );
  }

  closeMessages() {
    this.error.set(null);
    this.notice.set(null);
  }

  formatTool(value?: string | null) {
    return value ? value.replaceAll('_', ' ') : 'Sin herramienta';
  }

  formatDuration(value?: number | null) {
    if (!value) return '0 ms';
    return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`;
  }

  private showNotice(message: string) {
    this.notice.set(message);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(null), 4500);
  }
}
