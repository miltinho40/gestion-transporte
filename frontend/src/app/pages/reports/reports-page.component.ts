import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LucideDownload, LucideFileSpreadsheet } from '@lucide/angular';
import { ApiService } from '../../core/api.service';

type WeeklyReportType = 'viajes-conductor' | 'viajes-vehiculo' | 'ingresos-egresos';
type ExportFormat = 'xlsx' | 'pdf';

@Component({
  selector: 'app-reports-page',
  imports: [ReactiveFormsModule, LucideDownload, LucideFileSpreadsheet],
  templateUrl: './reports-page.component.html'
})
export class ReportsPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly error = signal<string | null>(null);
  readonly downloading = signal(false);

  readonly weeklyForm = this.fb.nonNullable.group({
    anio: [new Date().getFullYear()],
    numero_semana: [this.isoWeek(new Date())],
    tipo: ['viajes-vehiculo' as WeeklyReportType]
  });

  readonly maintenanceForm = this.fb.nonNullable.group({
    fecha_desde: [''],
    fecha_hasta: [''],
    placa: [''],
    palabra_clave: [''],
    por_vencer: [false]
  });

  exportWeekly(format: ExportFormat) {
    const { anio, numero_semana, tipo } = this.weeklyForm.getRawValue();
    this.download(`/reportes-semanales/${tipo}/export`, {
      anio,
      numero_semana,
      formato: format
    });
  }

  exportMaintenance(format: ExportFormat) {
    const params = this.maintenanceForm.getRawValue();
    this.download('/reportes/mantenimientos/export', {
      ...params,
      formato: format
    });
  }

  private download(path: string, params: Record<string, string | number | boolean>) {
    this.error.set(null);
    this.downloading.set(true);

    this.api.download(path, params).subscribe({
      next: (response) => {
        const filename = this.api.filenameFromDisposition(
          response.headers.get('content-disposition'),
          'reporte'
        );
        this.api.saveBlob(response.body!, filename);
        this.downloading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo exportar el reporte.');
        this.downloading.set(false);
      }
    });
  }

  private isoWeek(date: Date) {
    const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
