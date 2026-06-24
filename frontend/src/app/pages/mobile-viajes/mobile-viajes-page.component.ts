import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideCheck,
  LucideClipboardList,
  LucideCopy,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch
} from '@lucide/angular';
import { Subscription, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { formatDateOnly } from '../../core/date-only';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { DialogService } from '../../shared/dialog.service';
import {
  ClienteOption,
  EstadoViaje,
  VehiculoOption,
  ViajeRow,
  dateSortValue,
  estadoLabel,
  isoWeekInfo,
  numberValue
} from './mobile-viajes.types';

const searchText = (...values: unknown[]) =>
  values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .join(' ')
    .toLowerCase();

const todayInputDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

@Component({
  selector: 'app-mobile-viajes-page',
  imports: [
    FormsModule,
    RouterLink,
    LucideCheck,
    LucideClipboardList,
    LucideCopy,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    AutoDismissAlertDirective
  ],
  templateUrl: './mobile-viajes-page.component.html',
  styleUrl: './mobile-viajes-page.component.scss'
})
export class MobileViajesPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly sub = new Subscription();

  readonly rows = signal<ViajeRow[]>([]);
  readonly clientes = signal<ClienteOption[]>([]);
  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly loading = signal(false);
  readonly markingCobroId = signal<string | null>(null);
  readonly savingGuidesId = signal<string | null>(null);
  readonly search = signal('');
  readonly estado = signal('');
  readonly cobrado = signal('');
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly guideRow = signal<ViajeRow | null>(null);
  readonly guideInput = signal('');

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
        viajes: this.api.get<ViajeRow[]>('/viajes'),
        clientes: this.api.get<ClienteOption[]>('/clientes', { activo: true }),
        vehiculos: this.api.get<VehiculoOption[]>('/vehiculos')
      }).subscribe({
        next: ({ viajes, clientes, vehiculos }) => {
          this.rows.set(viajes);
          this.clientes.set(clientes);
          this.vehiculos.set(vehiculos);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron cargar los viajes.');
          this.loading.set(false);
        }
      })
    );
  }

  filteredRows() {
    const term = this.search().trim().toLowerCase();
    const estado = this.estado();
    const cobrado = this.cobrado();

    return this.rows()
      .filter((row) => !estado || row.estado === estado)
      .filter((row) => cobrado === '' || String(row.cobrado) === cobrado)
      .filter((row) => !term || this.rowSearchText(row).includes(term))
      .sort((left, right) => {
        const rightDate = right.fecha_llegada || right.fecha_salida;
        const leftDate = left.fecha_llegada || left.fecha_salida;
        return dateSortValue(rightDate) - dateSortValue(leftDate) || Number(right.id) - Number(left.id);
      });
  }

  async marcarCobrado(row: ViajeRow) {
    if (row.cobrado || row.estado === 'cancelado') return;

    const confirmed = await this.dialog.confirm({
      title: 'Marcar viaje como cobrado',
      text: `Se registrara la fecha de cobro de hoy para ${row.cliente?.nombre ?? 'este viaje'}.`,
      confirmText: 'Marcar cobrado'
    });

    if (!confirmed) return;

    this.markingCobroId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api
        .patch<ViajeRow>(`/viajes/${row.id}/cobro`, {
          cobrado: true,
          fecha_cobro: todayInputDate()
        })
        .subscribe({
          next: () => {
            this.markingCobroId.set(null);
            this.message.set('Viaje marcado como cobrado.');
            this.load();
          },
          error: (err) => {
            this.markingCobroId.set(null);
            this.error.set(err?.error?.message ?? 'No se pudo marcar el viaje como cobrado.');
          }
        })
    );
  }

  edit(row: ViajeRow) {
    void this.router.navigate(['/movil/viajes', row.id, 'editar']);
  }

  duplicate(row: ViajeRow) {
    void this.router.navigate(['/movil/viajes/nuevo'], {
      queryParams: { duplicateFrom: row.id }
    });
  }

  openGuides(row: ViajeRow) {
    if (row.cobrado || row.estado === 'cancelado') return;

    this.guideRow.set(row);
    this.guideInput.set('');
    this.message.set(null);
    this.error.set(null);
  }

  closeGuides() {
    this.guideRow.set(null);
    this.guideInput.set('');
  }

  saveGuides() {
    const row = this.guideRow();
    const value = this.guideInput().trim();
    if (!row || !value) {
      this.error.set('Ingresa al menos una guía.');
      return;
    }

    this.savingGuidesId.set(row.id);
    this.error.set(null);
    this.message.set(null);

    this.sub.add(
      this.api
        .patch<ViajeRow>(`/viajes/${row.id}/guias`, {
          numeros_guia_remision: value
        })
        .subscribe({
          next: () => {
            this.savingGuidesId.set(null);
            this.closeGuides();
            this.message.set('Guías agregadas al viaje.');
            this.load();
          },
          error: (err) => {
            this.savingGuidesId.set(null);
            this.error.set(err?.error?.message ?? 'No se pudieron agregar las guías.');
          }
        })
    );
  }

  money(value: unknown) {
    return numberValue(value).toFixed(2);
  }

  dateOnly(value: unknown) {
    return formatDateOnly(value);
  }

  estadoLabel(estado: EstadoViaje) {
    return estadoLabel(estado);
  }

  rutaLabel(row: ViajeRow) {
    const tarifa = row.tarifa_ruta;
    if (!tarifa) return '-';
    return `${tarifa.ruta.origen} - ${tarifa.ruta.destino}`;
  }

  guiasLabel(row: ViajeRow) {
    return (row.numeros_guia_remision ?? []).join(', ');
  }

  semanaLabel(row: ViajeRow) {
    return isoWeekInfo(row.fecha_llegada || row.fecha_salida).label;
  }

  utilidad(row: ViajeRow) {
    return numberValue(row.precio_real_flete) - numberValue(row.costo_real_gastos);
  }

  clienteFilterLabel(cliente: ClienteOption) {
    return `${cliente.nombre} - ${cliente.ruc_cedula}`;
  }

  vehiculoFilterLabel(vehiculo: VehiculoOption) {
    return [vehiculo.placa, vehiculo.marca].filter(Boolean).join(' - ');
  }

  private rowSearchText(row: ViajeRow) {
    return searchText(
      row.cliente?.nombre,
      row.cliente?.ruc_cedula,
      row.vehiculo?.placa,
      row.vehiculo?.marca,
      row.conductor?.nombre,
      this.rutaLabel(row),
      row.numeros_guia_remision?.join(' '),
      row.descripcion_carga
    );
  }
}
