import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LucideCalculator, LucideRefreshCw } from '@lucide/angular';
import { ApiService } from '../../core/api.service';

interface CierreSemanal {
  semana: {
    anio: number;
    numero_semana: number;
    fecha_inicio: string;
    fecha_fin: string;
  };
  resumen: {
    cantidad_viajes: number;
    cantidad_mantenimientos: number;
    cantidad_gastos_semanales: number;
    totales: Record<string, unknown>;
  };
  conductores: {
    conductor: { nombre: string; cedula: string };
    cantidad_viajes: number;
    sueldo_semanal: string;
    bonificacion_sugerida: string;
    vehiculo_asignado_gasto: { placa: string } | null;
  }[];
  vehiculos: {
    vehiculo: { placa: string; marca: string; modelo: string | null };
    cantidad_viajes: number;
    cantidad_mantenimientos: number;
    cantidad_gastos_semanales: number;
    totales: Record<string, unknown>;
  }[];
}

@Component({
  selector: 'app-weekly-closure-page',
  imports: [ReactiveFormsModule, LucideCalculator, LucideRefreshCw],
  templateUrl: './weekly-closure-page.component.html'
})
export class WeeklyClosurePageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly cierre = signal<CierreSemanal | null>(null);

  readonly form = this.fb.nonNullable.group({
    anio: [new Date().getFullYear()],
    numero_semana: [this.isoWeek(new Date())]
  });

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    const { anio, numero_semana } = this.form.getRawValue();

    this.api.get<CierreSemanal>('/cierres-semanales', { anio, numero_semana }).subscribe({
      next: (cierre) => {
        this.cierre.set(cierre);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar el cierre semanal.');
        this.loading.set(false);
      }
    });
  }

  generarGastos() {
    this.generating.set(true);
    this.error.set(null);
    this.message.set(null);
    const { anio, numero_semana } = this.form.getRawValue();

    this.api
      .post<{ cierre: CierreSemanal }>('/cierres-semanales/generar-gastos', {
        anio,
        numero_semana
      })
      .subscribe({
        next: (response) => {
          this.cierre.set(response.cierre);
          this.message.set('Gastos generados o actualizados para la semana.');
          this.generating.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron generar gastos.');
          this.generating.set(false);
        }
      });
  }

  money(value: unknown) {
    return value ?? '0';
  }

  private isoWeek(date: Date) {
    const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
