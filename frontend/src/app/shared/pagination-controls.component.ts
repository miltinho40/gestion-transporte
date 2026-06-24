import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PaginationMeta } from '../core/pagination';

@Component({
  selector: 'app-pagination-controls',
  imports: [FormsModule],
  template: `
    @if (meta) {
      <div class="pagination-controls">
        <div class="pagination-summary">
          Mostrando {{ startItem() }}-{{ endItem() }} de {{ meta.total }}
        </div>

        <div class="pagination-actions">
          <label class="pagination-limit">
            <span>Por página</span>
            <select
              class="form-select form-select-sm"
              [ngModel]="meta.limit"
              (ngModelChange)="limitChange.emit($event)"
              [disabled]="loading"
            >
              @for (option of pageSizeOptions; track option) {
                <option [ngValue]="option">{{ option }}</option>
              }
            </select>
          </label>

          <div class="btn-group btn-group-sm">
            <button
              type="button"
              class="btn btn-outline-secondary"
              [disabled]="loading || !meta.has_previous"
              (click)="pageChange.emit(meta.page - 1)"
            >
              Anterior
            </button>
            <button type="button" class="btn btn-outline-secondary" disabled>
              {{ meta.page }} / {{ meta.total_pages }}
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              [disabled]="loading || !meta.has_next"
              (click)="pageChange.emit(meta.page + 1)"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .pagination-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border-top: 1px solid var(--app-border);
        background: var(--app-surface);
      }

      .pagination-summary,
      .pagination-limit span {
        color: var(--app-muted);
        font-size: 0.82rem;
        font-weight: 600;
      }

      .pagination-actions,
      .pagination-limit {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .pagination-limit .form-select {
        width: 82px;
      }

      @media (max-width: 640px) {
        .pagination-controls {
          align-items: stretch;
          flex-direction: column;
        }

        .pagination-actions {
          justify-content: space-between;
        }
      }
    `
  ]
})
export class PaginationControlsComponent {
  @Input() meta: PaginationMeta | null = null;
  @Input() loading = false;
  @Input() pageSizeOptions = [25, 50, 100];
  @Output() pageChange = new EventEmitter<number>();
  @Output() limitChange = new EventEmitter<number>();

  startItem() {
    if (!this.meta || this.meta.total === 0) return 0;
    return (this.meta.page - 1) * this.meta.limit + 1;
  }

  endItem() {
    if (!this.meta) return 0;
    return Math.min(this.meta.page * this.meta.limit, this.meta.total);
  }
}
