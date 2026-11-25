import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideCalculator, LucideCopy, LucideRefreshCw } from '@lucide/angular';
import { WeeklyClosureApiService } from './weekly-closure-api.service';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { DialogService } from '../../shared/dialog.service';

import type {
  CierreSemanal,
  VehiculoOption,
  AsistenteCierre,
  AsistenteCierreAlerta,
  ActividadSemanalItem,
} from './weekly-closure.models';
import { WeeklyClosureAssistantComponent } from './weekly-closure-assistant.component';
import { WeeklyClosureActivityComponent } from './weekly-closure-activity.component';
import * as closure from './weekly-closure.helpers';
import * as image from './weekly-closure-image';
import { createWeeklyReportImage } from './weekly-closure-web-image';

@Component({
  selector: 'app-weekly-closure-page',
  imports: [
    ReactiveFormsModule,
    LucideCalculator,
    LucideCopy,
    LucideRefreshCw,
    AutoDismissAlertDirective,
    WeeklyClosureAssistantComponent,
    WeeklyClosureActivityComponent,
  ],
  templateUrl: './weekly-closure-page.component.html',
})
export class WeeklyClosurePageComponent implements OnDestroy {
  private readonly api = inject(WeeklyClosureApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  readonly loading = signal(false);
  readonly loadingVehiculos = signal(false);
  readonly generating = signal(false);
  readonly copyingReport = signal(false);
  readonly markingCobroId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly cierre = signal<CierreSemanal | null>(null);
  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly consultedKey = signal('');
  private readonly noticeRefresh = signal(0);

  readonly form = this.fb.nonNullable.group({
    anio: [new Date().getFullYear()],
    numero_semana: [closure.isoWeek(new Date())],
    vehiculo_id: ['', Validators.required],
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const anio = Number(params.get('anio'));
      const numeroSemana = Number(params.get('numero_semana') ?? params.get('semana'));
      const vehiculoId = params.get('vehiculo_id');

      if (!Number.isFinite(anio) || !Number.isFinite(numeroSemana) || !vehiculoId) return;

      this.form.patchValue({
        anio,
        numero_semana: numeroSemana,
        vehiculo_id: vehiculoId,
      });
      this.load();
    });
    this.loadVehiculos();
  }

  ngOnDestroy() {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
    }
  }

  loadVehiculos() {
    this.loadingVehiculos.set(true);
    this.error.set(null);

    this.api.listVehiculos().subscribe({
      next: (vehiculos) => {
        this.vehiculos.set(vehiculos);
        if (!this.form.controls.vehiculo_id.value && vehiculos[0]) {
          this.form.controls.vehiculo_id.setValue(String(vehiculos[0].id));
        }
        this.loadingVehiculos.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron cargar los vehículos.');
        this.loadingVehiculos.set(false);
      },
    });
  }

  load() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Selecciona un vehículo para consultar el cierre semanal.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.clearMessage();
    this.consultedKey.set('');
    const { anio, numero_semana, vehiculo_id } = this.form.getRawValue();

    this.api.getCierre({ anio, numero_semana, vehiculo_id }).subscribe({
      next: (cierre) => {
        this.cierre.set(cierre);
        this.noticeRefresh.update((value) => value + 1);
        this.consultedKey.set(this.currentConsultKey());
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar el cierre semanal.');
        this.cierre.set(null);
        this.loading.set(false);
      },
    });
  }

  generarGastos() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Selecciona un vehículo para generar los gastos del cierre.');
      return;
    }

    const cierre = this.cierre();
    const disabledMessage = this.generateDisabledMessage(cierre);
    if (disabledMessage) {
      this.error.set(disabledMessage);
      this.clearMessage();
      return;
    }

    this.generating.set(true);
    this.error.set(null);
    this.clearMessage();
    const isRegeneration = this.gastosYaGenerados(cierre);
    const { anio, numero_semana, vehiculo_id } = this.form.getRawValue();

    this.api
      .generarGastos({
        anio,
        numero_semana,
        vehiculo_id,
      })
      .subscribe({
        next: (response) => {
          this.cierre.set(response.cierre);
          this.noticeRefresh.update((value) => value + 1);
          this.consultedKey.set(this.currentConsultKey());
          this.showMessage(
            isRegeneration
              ? 'Gastos regenerados y cierre actualizado para el vehículo y semana.'
              : 'Gastos generados o actualizados para el vehículo y semana.',
          );
          this.generating.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron generar gastos.');
          this.generating.set(false);
        },
      });
  }

  async copyAndSendReport() {
    const cierre = this.cierre();
    const disabledMessage = this.copyDisabledMessage(cierre);

    if (!cierre || disabledMessage) {
      this.error.set(disabledMessage ?? 'Consulta primero el cierre semanal.');
      this.clearMessage();
      return;
    }

    this.copyingReport.set(true);
    this.error.set(null);
    this.clearMessage();

    try {
      const blob = await this.createWeeklyReportImage(cierre);
      const fileName = this.weeklyReportFileName(cierre);

      if (await this.copyImageToClipboard(blob)) {
        this.showMessage('Imagen copiada. Puedes pegarla para enviarla.');
        return;
      }

      if (await this.shareImage(blob, fileName, cierre)) {
        this.showMessage('Reporte listo para enviar.');
        return;
      }

      this.downloadImage(blob, fileName);
      this.showMessage('Tu navegador no permite copiar la imagen; se descargo el reporte.');
    } catch (err) {
      this.error.set('No se pudo copiar o enviar la imagen del cierre semanal.');
    } finally {
      this.copyingReport.set(false);
    }
  }

  clearMessage() {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
    this.message.set(null);
  }

  consultedForCurrentForm() {
    return this.consultedKey() === this.currentConsultKey();
  }

  readonly semanaTerminada = closure.semanaTerminada;

  readonly gastosYaGenerados = closure.gastosYaGenerados;

  readonly cierreRequiereRevision = closure.cierreRequiereRevision;

  asistenteCierre(cierre: CierreSemanal | null) {
    return cierre?.asistente_cierre ?? null;
  }

  readonly assistantRiskLabel = closure.assistantRiskLabel;

  readonly assistantSeverityLabel = closure.assistantSeverityLabel;

  generatedNoticeKey(cierre: CierreSemanal) {
    return [
      cierre.vehiculo.id,
      cierre.semana.anio,
      cierre.semana.numero_semana,
      cierre.resumen.cantidad_gastos_generados,
      this.noticeRefresh(),
    ].join(':');
  }

  canGenerateGastos(cierre: CierreSemanal | null) {
    return (
      this.consultedForCurrentForm() &&
      !!cierre &&
      this.semanaTerminada(cierre) &&
      (!this.gastosYaGenerados(cierre) || this.cierreRequiereRevision(cierre))
    );
  }

  canCopyWeeklyImage(cierre: CierreSemanal | null) {
    return this.consultedForCurrentForm() && !!cierre && !this.semanaFutura(cierre);
  }

  generateButtonLabel(cierre: CierreSemanal | null) {
    if (this.generating()) return 'Generando...';
    if (!this.consultedForCurrentForm() || !cierre) return 'Consultar primero';
    if (!this.semanaTerminada(cierre)) return 'Semana abierta';
    if (this.gastosYaGenerados(cierre) && this.cierreRequiereRevision(cierre)) {
      return 'Regenerar gastos';
    }
    if (this.gastosYaGenerados(cierre)) return 'Gastos ya generados';
    return 'Generar gastos';
  }

  readonly money = closure.money;

  readonly moneyOrDash = closure.moneyOrDash;

  readonly dateOnly = closure.dateOnly;

  readonly vehiculoLabel = closure.vehiculoLabel;

  readonly transportistaLabel = closure.transportistaLabel;

  readonly totalSueldoSemanal = closure.totalSueldoSemanal;

  readonly totalBonos = closure.totalBonos;

  readonly totalSueldoBonos = closure.totalSueldoBonos;

  readonly totalSemanaReporte = closure.totalSemanaReporte;

  readonly totalPrecioViajes = closure.totalPrecioViajes;

  readonly gananciaSemanal = closure.gananciaSemanal;

  readonly cantidadRetornos = closure.cantidadRetornos;

  readonly totalGastoRetornoRetornos = closure.totalGastoRetornoRetornos;

  readonly cantidadDomingos = closure.cantidadDomingos;

  readonly totalGastoRetornoDomingos = closure.totalGastoRetornoDomingos;

  gananciaSemanalClass(cierre: CierreSemanal) {
    return this.gananciaSemanal(cierre) >= 0
      ? 'weekly-summary-card-info'
      : 'weekly-summary-card-danger';
  }

  readonly actividadSemanal = closure.actividadSemanal;

  editarActividad(item: ActividadSemanalItem) {
    const route = item.sourceType === 'viaje' ? '/app/reportes' : '/app/mantenimientos';
    void this.router.navigate([route], {
      queryParams: {
        edit: item.sourceId,
        returnUrl: this.cierreReturnUrl(),
      },
    });
  }

  editarAlertaAsistente(alerta: AsistenteCierreAlerta) {
    if (
      !alerta.source_id ||
      (alerta.source_type !== 'viaje' && alerta.source_type !== 'mantenimiento')
    ) {
      return;
    }

    const route = alerta.source_type === 'viaje' ? '/app/reportes' : '/app/mantenimientos';
    void this.router.navigate([route], {
      queryParams: {
        edit: alerta.source_id,
        returnUrl: this.cierreReturnUrl(),
      },
    });
  }

  async copiarViajeActividad(item: ActividadSemanalItem) {
    if (!item.copyText) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.copyText);
      } else {
        this.copyTextFallback(item.copyText);
      }

      this.error.set(null);
      this.showMessage('Texto del viaje copiado.');
    } catch {
      this.error.set('No se pudo copiar el texto del viaje.');
      this.clearMessage();
    }
  }

  async marcarCobradoActividad(item: ActividadSemanalItem) {
    if (item.sourceType !== 'viaje' || item.cobrado) return;

    const support = await this.dialog.supportPrompt({
      title: 'Marcar viaje como cobrado',
      text: 'Registra el soporte del cobro para este viaje.',
      dateLabel: 'Fecha de cobro',
      supportLabel: 'Numero de factura / soporte',
      noInvoiceLabel: 'No se emitio factura',
      confirmText: 'Marcar cobrado',
      defaultDate: closure.todayInputDate(),
    });
    if (!support) return;

    this.markingCobroId.set(item.sourceId);
    this.error.set(null);
    this.clearMessage();

    this.api
      .marcarCobrado(item.sourceId, {
        cobrado: true,
        fecha_cobro: support.fecha,
        soporte_cobro: support.soporte,
        sin_factura_cobro: support.sin_factura,
      })
      .subscribe({
        next: () => {
          this.markingCobroId.set(null);
          const current = this.cierre();
          if (current) {
            this.cierre.set({
              ...current,
              viajes: current.viajes.map((viaje) =>
                viaje.id === item.sourceId ? { ...viaje, cobrado: true } : viaje,
              ),
            });
          }
          this.showMessage('Viaje marcado como cobrado.');
        },
        error: (err) => {
          this.markingCobroId.set(null);
          this.error.set(err?.error?.message ?? 'No se pudo marcar el viaje como cobrado.');
        },
      });
  }

  private copyTextFallback(text: string) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  private cierreReturnUrl() {
    const { anio, numero_semana, vehiculo_id } = this.form.getRawValue();

    return this.router.serializeUrl(
      this.router.createUrlTree(['/app/cierre-semanal'], {
        queryParams: { anio, numero_semana, vehiculo_id },
      }),
    );
  }

  private showMessage(text: string) {
    this.clearMessage();
    this.message.set(text);
    this.messageTimer = setTimeout(() => this.clearMessage(), 4500);
  }

  private generateDisabledMessage(cierre: CierreSemanal | null) {
    if (!this.consultedForCurrentForm() || !cierre) {
      return 'Consulta primero el cierre semanal.';
    }

    if (!this.semanaTerminada(cierre)) {
      return 'No se pueden generar gastos porque la semana aun no termina.';
    }

    if (this.gastosYaGenerados(cierre) && !this.cierreRequiereRevision(cierre)) {
      return 'Los gastos de esta semana ya fueron generados.';
    }

    return null;
  }

  private copyDisabledMessage(cierre: CierreSemanal | null) {
    if (!this.consultedForCurrentForm() || !cierre) {
      return 'Consulta primero el cierre semanal.';
    }

    if (this.semanaFutura(cierre)) {
      return 'No se puede copiar el reporte de una semana futura.';
    }

    return null;
  }

  private readonly semanaFutura = closure.semanaFutura;

  private readonly createWeeklyReportImage = createWeeklyReportImage;

  private readonly copyImageToClipboard = image.copyImageToClipboard;

  private readonly shareImage = image.shareImage;

  private readonly downloadImage = image.downloadImage;

  private readonly weeklyReportFileName = image.weeklyReportFileName;

  private currentConsultKey() {
    const { anio, numero_semana, vehiculo_id } = this.form.getRawValue();
    return `${anio}:${numero_semana}:${vehiculo_id}`;
  }
}
