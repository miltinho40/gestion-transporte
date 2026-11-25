import { Component, computed, input, output } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  LucideCheck,
  LucideCopy,
  LucideEye,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideRotateCcw,
  LucideSearch,
  LucideTrash2
} from '@lucide/angular';
import {
  MultiSelectFilterComponent,
  type MultiSelectFilterValue
} from '../../shared/multi-select-filter.component';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';
import type { PaginationMeta } from '../../core/pagination';
import type {
  ClienteOption,
  ProveedorOption,
  ProveedorFilterForm,
  ProveedorRowAction,
  ProveedorBulkAction,
  ViajeProveedorRow
} from './proveedor-transporte.models';
import {
  clienteLabel,
  proveedorLabel,
  money,
  number,
  dateOnly,
  weekNumber,
  guiaPreview,
  rutaLabel
} from './proveedor-transporte.helpers';

@Component({
  selector: 'app-proveedor-trip-list',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    LucideCheck,
    LucideCopy,
    LucideEye,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideRotateCcw,
    LucideSearch,
    LucideTrash2,
    MultiSelectFilterComponent,
    PaginationControlsComponent
  ],
  templateUrl: './proveedor-trip-list.component.html',
  styleUrl: './proveedor-trip-list.component.scss'
})
export class ProveedorTripListComponent {
  readonly filters = input.required<ProveedorFilterForm>();
  readonly rows = input<ViajeProveedorRow[]>([]);
  readonly clientes = input<ClienteOption[]>([]);
  readonly proveedores = input<ProveedorOption[]>([]);
  readonly selectedIds = input<string[]>([]);
  readonly selectedClientIds = input<string[]>([]);
  readonly selectedProviderIds = input<string[]>([]);
  readonly loading = input(false);
  readonly pagination = input<PaginationMeta | null>(null);
  readonly deletingId = input<string | null>(null);
  readonly guideEditTripId = input<string | null>(null);
  readonly guideInput = input('');
  readonly detailOpen = input(false);
  readonly detailRowId = input<string | null>(null);
  readonly clientIdsChange = output<string[]>();
  readonly providerIdsChange = output<string[]>();
  readonly pageChange = output<number>();
  readonly limitChange = output<number>();
  readonly selectionChanged = output<{ row: ViajeProveedorRow; checked: boolean }>();
  readonly allSelectionChanged = output<boolean>();
  readonly guideInputChange = output<string>();
  readonly guideCancelled = output<void>();
  readonly rowAction = output<ProveedorRowAction>();
  readonly bulkAction = output<ProveedorBulkAction>();
  readonly clienteLabel = clienteLabel;
  readonly proveedorLabel = proveedorLabel;
  readonly money = money;
  readonly number = number;
  readonly dateOnly = dateOnly;
  readonly weekNumber = weekNumber;
  readonly guiaPreview = guiaPreview;
  readonly rutaLabel = rutaLabel;
  readonly clienteFilterOptions = computed(() =>
    this.clientes().map((cliente) => ({
      value: cliente.id,
      label: this.clienteLabel(cliente),
      chipLabel: cliente.nombre,
      searchText: `${cliente.nombre} ${cliente.ruc_cedula}`
    }))
  );

  readonly proveedorFilterOptions = computed(() =>
    this.proveedores().map((proveedor) => ({
      value: proveedor.id,
      label: this.proveedorLabel(proveedor),
      chipLabel: proveedor.nombre,
      searchText: `${proveedor.nombre} ${proveedor.ruc_cedula}`
    }))
  );

  readonly selectedRows = computed(() => {
    const ids = new Set(this.selectedIds());
    return this.rows().filter((row) => ids.has(row.id));
  });

  readonly summaryRows = computed(() => {
    const selected = this.selectedRows();
    return selected.length ? selected : this.rows();
  });

  readonly summary = computed(() => {
    const rows = this.summaryRows();
    const clientes = new Set(rows.map((row) => row.cliente?.id));
    const proveedores = new Set(rows.map((row) => row.proveedor?.id));

    return {
      viajes: rows.length,
      clientes: clientes.size,
      proveedores: proveedores.size,
      precio_viaje: rows.reduce((total, row) => total + this.number(row.precio_viaje), 0),
      valor_a_facturar: rows.reduce((total, row) => total + this.number(row.valor_a_facturar), 0),
      precio_pagar_proveedor: rows.reduce(
        (total, row) => total + this.number(row.precio_pagar_proveedor),
        0
      ),
      viaticos: rows.reduce((total, row) => total + this.number(row.viaticos), 0),
      utilidad: rows.reduce((total, row) => total + this.number(row.utilidad), 0),
      pendientes_cobro: rows.filter((row) => !row.cobrado).length,
      pendientes_pago: rows.filter((row) => !row.pagado_proveedor).length
    };
  });

  isSelected(row: ViajeProveedorRow) {
    return this.selectedIds().includes(row.id);
  }

  allVisibleSelected() {
    const rows = this.rows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  hasSelected() {
    return this.selectedIds().length > 0;
  }

  selectedCount() {
    return this.selectedIds().length;
  }
  setSelectedClients(values: MultiSelectFilterValue[]) {
    this.clientIdsChange.emit(values.map(String));
  }
  setSelectedProviders(values: MultiSelectFilterValue[]) {
    this.providerIdsChange.emit(values.map(String));
  }
}
