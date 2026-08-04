import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

export type MultiSelectFilterValue = string | number;

export interface MultiSelectFilterOption {
  value: MultiSelectFilterValue;
  label: string;
  chipLabel?: string;
  searchText?: string;
}

@Component({
  selector: 'app-multi-select-filter',
  imports: [FormsModule],
  template: `
    <label class="form-label">{{ label() }}</label>
    <div class="reports-combo">
      <button
        class="form-select form-select-sm reports-combo-toggle"
        type="button"
        (click)="toggleOpen()"
        [disabled]="disabled()"
      >
        @if (selectedOptions().length) {
          {{ selectedOptions().length }} {{ selectedLabel() }}
        } @else {
          {{ emptyLabel() }}
        }
      </button>

      @if (open()) {
        <div class="reports-combo-menu">
          <input
            class="form-control form-control-sm"
            type="search"
            [placeholder]="searchPlaceholder()"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
            [ngModelOptions]="{ standalone: true }"
          />

          <div class="reports-combo-options">
            @for (option of filteredOptions(); track option.value) {
              <label class="reports-combo-option">
                <input
                  class="form-check-input"
                  type="checkbox"
                  [checked]="isSelected(option.value)"
                  (change)="toggleSelection(option.value, $any($event.target).checked)"
                />
                <span>{{ option.label }}</span>
              </label>
            } @empty {
              <span class="reports-combo-empty">Sin resultados</span>
            }
          </div>

          <button class="btn btn-link btn-sm p-0" type="button" (click)="clear()">
            Limpiar
          </button>
        </div>
      }
    </div>

    @if (selectedOptions().length) {
      <div class="reports-chip-list">
        @for (option of selectedOptions(); track option.value) {
          <button class="reports-chip" type="button" (click)="remove(option.value)">
            {{ option.chipLabel ?? option.label }} <span aria-hidden="true">x</span>
          </button>
        }
      </div>
    }
  `
})
export class MultiSelectFilterComponent {
  readonly label = input.required<string>();
  readonly emptyLabel = input.required<string>();
  readonly selectedLabel = input.required<string>();
  readonly searchPlaceholder = input('Buscar');
  readonly options = input<MultiSelectFilterOption[]>([]);
  readonly selectedValues = input<MultiSelectFilterValue[]>([]);
  readonly disabled = input(false);
  readonly selectedValuesChange = output<MultiSelectFilterValue[]>();

  readonly open = signal(false);
  readonly search = signal('');

  readonly selectedOptions = computed(() => {
    const selected = new Set(this.selectedValues().map((value) => String(value)));
    return this.options().filter((option) => selected.has(String(option.value)));
  });

  readonly filteredOptions = computed(() => {
    const search = this.search().trim().toLowerCase();
    if (!search) return this.options();

    return this.options().filter((option) =>
      (option.searchText ?? option.label).toLowerCase().includes(search)
    );
  });

  toggleOpen() {
    this.open.update((value) => !value);
  }

  isSelected(value: MultiSelectFilterValue) {
    return this.selectedValues().some((item) => String(item) === String(value));
  }

  toggleSelection(value: MultiSelectFilterValue, checked: boolean) {
    const selected = new Set(this.selectedValues().map((item) => String(item)));
    const originalValues = new Map(this.selectedValues().map((item) => [String(item), item]));

    if (checked) {
      selected.add(String(value));
      originalValues.set(String(value), value);
    } else {
      selected.delete(String(value));
      originalValues.delete(String(value));
    }

    this.selectedValuesChange.emit([...selected].map((item) => originalValues.get(item) ?? item));
  }

  remove(value: MultiSelectFilterValue) {
    this.selectedValuesChange.emit(
      this.selectedValues().filter((item) => String(item) !== String(value))
    );
  }

  clear() {
    this.search.set('');
    this.selectedValuesChange.emit([]);
  }
}
