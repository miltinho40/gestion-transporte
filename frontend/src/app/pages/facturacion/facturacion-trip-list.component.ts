import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideEye, LucidePencil, LucideSave } from '@lucide/angular';
import {
  MultiSelectFilterComponent,
  type MultiSelectFilterValue
} from '../../shared/multi-select-filter.component';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';
import type { PaginationMeta } from '../../core/pagination';
import type { Cliente, Trip, Vehicle } from './facturacion.models';
import { guides, key, money, selectionState, shortGuides, week } from './facturacion.view-helpers';

@Component({
  selector: 'app-facturacion-trip-list',
  imports: [
    FormsModule,
    LucideEye,
    LucidePencil,
    LucideSave,
    MultiSelectFilterComponent,
    PaginationControlsComponent
  ],
  templateUrl: './facturacion-trip-list.component.html',
  styleUrl: './facturacion-trip-list.component.scss'
})
export class FacturacionTripListComponent {
  readonly trips = input<Trip[]>([]);
  readonly selected = input<Trip[]>([]);
  readonly clientes = input<Cliente[]>([]);
  readonly vehiculos = input<Vehicle[]>([]);
  readonly search = input('');
  readonly ownOnly = input(false);
  readonly page = input(1);
  readonly tripLimit = input(25);
  readonly total = input(0);
  readonly busy = input(false);
  readonly canWrite = input(false);
  readonly selectedClientIds = input<string[]>([]);
  readonly selectedVehicleIds = input<string[]>([]);
  readonly selectedWeeks = input<number[]>([]);
  readonly searchChange = output<string>();
  readonly ownOnlyChange = output<boolean>();
  readonly clientIdsChange = output<string[]>();
  readonly vehicleIdsChange = output<string[]>();
  readonly weeksChange = output<number[]>();
  readonly pageChange = output<number>();
  readonly limitChange = output<number>();
  readonly toggled = output<Trip>();
  readonly pageToggled = output<void>();
  readonly previewed = output<Trip>();
  readonly edited = output<Trip>();
  readonly billed = output<void>();
  readonly key = key;
  readonly money = money;
  readonly guides = guides;
  readonly shortGuides = shortGuides;
  readonly week = week;
  readonly clienteFilterOptions = computed(() =>
    this.clientes().map((c) => ({ value: c.id, label: c.nombre }))
  );
  readonly vehiculoFilterOptions = computed(() =>
    this.vehiculos().map((v) => ({ value: v.id, label: v.placa }))
  );
  readonly weekFilterOptions = Array.from({ length: 53 }, (_, i) => ({
    value: i + 1,
    label: `Semana ${i + 1}`
  }));
  readonly pageSelection = computed(() =>
    selectionState(this.trips(), new Set(this.selected().map(key)))
  );
  isSelected(t: Trip) {
    return this.selected().some((v) => this.key(v) === this.key(t));
  }
  paginationMeta(page: number, limit: number, total: number): PaginationMeta {
    const pages = Math.max(1, Math.ceil(total / limit));
    return {
      page,
      limit,
      total,
      total_pages: pages,
      has_next: page < pages,
      has_previous: page > 1
    };
  }
  setSelectedClients(values: MultiSelectFilterValue[]) {
    this.clientIdsChange.emit(values.map(String));
  }
  setSelectedVehicles(values: MultiSelectFilterValue[]) {
    this.vehicleIdsChange.emit(values.map(String));
  }
  setSelectedWeeks(values: MultiSelectFilterValue[]) {
    this.weeksChange.emit(values.map(Number));
  }
}
