import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideCalculator,
  LucideCheck,
  LucideClipboardList,
  LucideCopy,
  LucidePencil,
  LucideRefreshCw,
  LucideSend,
  LucideSparkles
} from '@lucide/angular';
import { WeeklyClosureApiService } from '../weekly-closure/weekly-closure-api.service';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { DialogService } from '../../shared/dialog.service';

import type {
  CierreSemanal,
  VehiculoOption,
  ViajeCierre,
  AsistenteCierre,
  AsistenteCierreAlerta
} from '../weekly-closure/weekly-closure.models';
interface ActividadSemanalItem {
  trackId: string;
  sourceId: string;
  sourceType: 'viaje' | 'mantenimiento';
  fecha: string;
  tipo: 'Viaje' | 'Retorno' | 'Mantenimiento';
  titulo: string;
  detalle: string;
  precio: string | number | null;
  facturar: string | number | null;
  viaticos: string | number | null;
  resultado: string | number | null;
  copyText: string | null;
  cobrado: boolean;
  estado: string;
  rowClass: string;
  sortTime: number;
}

import * as closure from '../weekly-closure/weekly-closure.helpers';
import * as image from '../weekly-closure/weekly-closure-image';
import { createWeeklyReportImage } from '../weekly-closure/weekly-closure-mobile-image';

@Component({
  selector: 'app-mobile-weekly-closure-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    LucideCalculator,
    LucideCheck,
    LucideClipboardList,
    LucideCopy,
    LucidePencil,
    LucideRefreshCw,
    LucideSend,
    LucideSparkles,
    AutoDismissAlertDirective
  ],
  templateUrl: './mobile-weekly-closure-page.component.html',
  styleUrl: './mobile-weekly-closure-page.component.scss'
})
export class MobileWeeklyClosurePageComponent implements OnDestroy {
  private readonly api = inject(WeeklyClosureApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  readonly vehiculos = signal<VehiculoOption[]>([]);
  readonly cierre = signal<CierreSemanal | null>(null);
  readonly loading = signal(false);
  readonly loadingVehiculos = signal(false);
  readonly generating = signal(false);
  readonly sharing = signal(false);
  readonly markingCobroId = signal<string | null>(null);
  readonly savingGuidesId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly consultedKey = signal('');
  readonly guideItem = signal<ActividadSemanalItem | null>(null);
  readonly guideInput = signal('');

  readonly form = this.fb.nonNullable.group({
    anio: [new Date().getFullYear()],
    numero_semana: [closure.isoWeek(new Date())],
    vehiculo_id: ['', Validators.required]
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
        vehiculo_id: vehiculoId
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
      }
    });
  }

  load() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Selecciona un vehículo para consultar.');
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
        this.consultedKey.set(this.currentConsultKey());
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar el cierre semanal.');
        this.cierre.set(null);
        this.loading.set(false);
      }
    });
  }

  generarGastos() {
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
    const { anio, numero_semana, vehiculo_id } = this.form.getRawValue();

    this.api
      .generarGastos({
        anio,
        numero_semana,
        vehiculo_id
      })
      .subscribe({
        next: (response) => {
          this.cierre.set(response.cierre);
          this.consultedKey.set(this.currentConsultKey());
          this.showMessage('Gastos generados o actualizados.');
          this.generating.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudieron generar gastos.');
          this.generating.set(false);
        }
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

    this.sharing.set(true);
    this.error.set(null);
    this.clearMessage();

    try {
      const blob = await this.createWeeklyReportImage(cierre);
      const fileName = this.weeklyReportFileName(cierre);

      if (await this.shareImage(blob, fileName, cierre)) {
        this.showMessage('Reporte listo para enviar.');
        return;
      }

      if (await this.copyImageToClipboard(blob)) {
        this.showMessage('Imagen copiada. Puedes pegarla en WhatsApp.');
        return;
      }

      this.downloadImage(blob, fileName);
      this.showMessage('No se pudo compartir directo; se descargó la imagen.');
    } catch {
      this.error.set('No se pudo copiar o enviar la imagen.');
    } finally {
      this.sharing.set(false);
    }
  }

  actividadSemanal(cierre: CierreSemanal): ActividadSemanalItem[] {
    const viajes = (cierre.viajes ?? []).map((viaje) => {
      const guiasRemision = closure.splitGuiasRemision(viaje.numeros_guia_remision ?? []);
      const guias = guiasRemision.length ? `Guías: ${guiasRemision.join(', ').slice(0, 10)}` : null;

      return {
        trackId: `viaje-${viaje.id}`,
        sourceId: viaje.id,
        sourceType: 'viaje' as const,
        fecha: this.dateOnly(this.fechaSemanaViaje(viaje)),
        tipo: viaje.retorno ? ('Retorno' as const) : ('Viaje' as const),
        titulo: `${viaje.ruta.origen} - ${viaje.ruta.destino}`,
        detalle: [viaje.cliente.nombre, viaje.conductor.nombre, guias].filter(Boolean).join(' | '),
        precio: viaje.precio_flete,
        facturar: viaje.precio_real_flete,
        viaticos: viaje.viaticos,
        resultado: viaje.utilidad,
        copyText: `1 viaje a ${viaje.ruta.destino} g#${guiasRemision.join(', ') || '-'}`,
        cobrado: viaje.cobrado,
        estado: this.estadoViajeLabel(viaje.estado),
        rowClass: viaje.cobrado ? 'activity-cobrado' : '',
        sortTime: this.dateSortValue(this.fechaSemanaViaje(viaje))
      };
    });

    const mantenimientos = (cierre.mantenimientos ?? []).map((mantenimiento) => ({
      trackId: `mantenimiento-${mantenimiento.id}`,
      sourceId: mantenimiento.id,
      sourceType: 'mantenimiento' as const,
      fecha: this.dateOnly(mantenimiento.fecha_mantenimiento),
      tipo: 'Mantenimiento' as const,
      titulo: mantenimiento.tipo_mantenimiento.nombre,
      detalle: mantenimiento.descripcion || this.vehiculoLabel(mantenimiento.vehiculo),
      precio: null,
      facturar: null,
      viaticos: null,
      resultado: mantenimiento.costo_total,
      copyText: null,
      cobrado: false,
      estado: this.estadoMantenimientoLabel(mantenimiento.estado),
      rowClass: 'activity-mantenimiento',
      sortTime: this.dateSortValue(mantenimiento.fecha_mantenimiento)
    }));

    const sortByDate = (left: ActividadSemanalItem, right: ActividadSemanalItem) => {
      if (left.sortTime !== right.sortTime) return left.sortTime - right.sortTime;
      return left.titulo.localeCompare(right.titulo);
    };

    return [...viajes.sort(sortByDate), ...mantenimientos.sort(sortByDate)];
  }

  asistenteCierre(cierre: CierreSemanal | null) {
    return cierre?.asistente_cierre ?? null;
  }

  readonly assistantRiskLabel = closure.assistantRiskLabel;

  assistantRiskClass(riesgo: AsistenteCierre['riesgo']) {
    const classes: Record<AsistenteCierre['riesgo'], string> = {
      bajo: 'assistant-risk-low',
      medio: 'assistant-risk-medium',
      alto: 'assistant-risk-high'
    };

    return classes[riesgo] ?? classes.bajo;
  }

  readonly assistantSeverityLabel = closure.assistantSeverityLabel;

  assistantSeverityClass(severidad: AsistenteCierreAlerta['severidad']) {
    const classes: Record<AsistenteCierreAlerta['severidad'], string> = {
      info: 'assistant-severity-info',
      advertencia: 'assistant-severity-warning',
      critica: 'assistant-severity-danger'
    };

    return classes[severidad] ?? classes.info;
  }

  editarActividad(item: ActividadSemanalItem) {
    const route =
      item.sourceType === 'viaje'
        ? ['/movil/viajes', item.sourceId, 'editar']
        : ['/movil/mantenimientos', item.sourceId, 'editar'];

    void this.router.navigate(route, {
      queryParams: { returnUrl: this.cierreReturnUrl() }
    });
  }

  editarAlertaAsistente(alerta: AsistenteCierreAlerta) {
    if (
      !alerta.source_id ||
      (alerta.source_type !== 'viaje' && alerta.source_type !== 'mantenimiento')
    ) {
      return;
    }

    const route =
      alerta.source_type === 'viaje'
        ? ['/movil/viajes', alerta.source_id, 'editar']
        : ['/movil/mantenimientos', alerta.source_id, 'editar'];

    void this.router.navigate(route, {
      queryParams: { returnUrl: this.cierreReturnUrl() }
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
      this.showMessage('Texto del viaje copiado.');
      this.error.set(null);
    } catch {
      this.error.set('No se pudo copiar el texto del viaje.');
      this.clearMessage();
    }
  }

  openGuides(item: ActividadSemanalItem) {
    if (item.sourceType !== 'viaje' || item.cobrado) return;

    this.guideItem.set(item);
    this.guideInput.set('');
    this.error.set(null);
    this.clearMessage();
  }

  closeGuides() {
    this.guideItem.set(null);
    this.guideInput.set('');
  }

  saveGuides() {
    const item = this.guideItem();
    const value = this.guideInput().trim();
    if (!item || !value) {
      this.error.set('Ingresa al menos una guía.');
      return;
    }

    this.savingGuidesId.set(item.sourceId);
    this.error.set(null);
    this.clearMessage();

    this.api.guardarGuias(item.sourceId, value).subscribe({
      next: () => {
        this.savingGuidesId.set(null);
        this.closeGuides();
        this.load();
        this.showMessage('Guías agregadas al viaje.');
      },
      error: (err) => {
        this.savingGuidesId.set(null);
        this.error.set(err?.error?.message ?? 'No se pudieron agregar las guías.');
      }
    });
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
      defaultDate: closure.todayInputDate()
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
        sin_factura_cobro: support.sin_factura
      })
      .subscribe({
        next: () => {
          this.markingCobroId.set(null);
          const current = this.cierre();
          if (current) {
            this.cierre.set({
              ...current,
              viajes: current.viajes.map((viaje) =>
                viaje.id === item.sourceId ? { ...viaje, cobrado: true } : viaje
              )
            });
          }
          this.showMessage('Viaje marcado como cobrado.');
        },
        error: (err) => {
          this.markingCobroId.set(null);
          this.error.set(err?.error?.message ?? 'No se pudo marcar el viaje como cobrado.');
        }
      });
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
    if (this.gastosYaGenerados(cierre) && this.cierreRequiereRevision(cierre))
      return 'Regenerar gastos';
    if (this.gastosYaGenerados(cierre)) return 'Gastos generados';
    return 'Generar gastos';
  }

  clearMessage() {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
    this.message.set(null);
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

  private readonly createWeeklyReportImage = createWeeklyReportImage;

  private readonly shareImage = image.shareImage;

  private readonly copyImageToClipboard = image.copyImageToClipboard;

  private readonly downloadImage = image.downloadImage;

  private readonly weeklyReportFileName = image.weeklyReportFileName;

  private cierreReturnUrl() {
    const { anio, numero_semana, vehiculo_id } = this.form.getRawValue();
    return this.router.serializeUrl(
      this.router.createUrlTree(['/movil/cierre-semanal'], {
        queryParams: { anio, numero_semana, vehiculo_id }
      })
    );
  }

  private generateDisabledMessage(cierre: CierreSemanal | null) {
    if (!this.consultedForCurrentForm() || !cierre) return 'Consulta primero el cierre semanal.';
    if (!this.semanaTerminada(cierre))
      return 'No se pueden generar gastos porque la semana aún no termina.';
    if (this.gastosYaGenerados(cierre) && !this.cierreRequiereRevision(cierre))
      return 'Los gastos de esta semana ya fueron generados.';
    return null;
  }

  private copyDisabledMessage(cierre: CierreSemanal | null) {
    if (!this.consultedForCurrentForm() || !cierre) return 'Consulta primero el cierre semanal.';
    if (this.semanaFutura(cierre)) return 'No se puede copiar el reporte de una semana futura.';
    return null;
  }

  private consultedForCurrentForm() {
    return this.consultedKey() === this.currentConsultKey();
  }

  private currentConsultKey() {
    const { anio, numero_semana, vehiculo_id } = this.form.getRawValue();
    return `${anio}:${numero_semana}:${vehiculo_id}`;
  }

  private readonly semanaTerminada = closure.semanaTerminada;

  private readonly semanaFutura = closure.semanaFutura;

  private readonly gastosYaGenerados = closure.gastosYaGenerados;

  private readonly cierreRequiereRevision = closure.cierreRequiereRevision;

  private showMessage(text: string) {
    this.clearMessage();
    this.message.set(text);
    this.messageTimer = setTimeout(() => this.clearMessage(), 4500);
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

  private readonly estadoViajeLabel = closure.estadoViajeLabel;

  private readonly estadoMantenimientoLabel = closure.estadoMantenimientoLabel;

  private readonly fechaSemanaViaje = closure.fechaSemanaViaje;

  private readonly dateSortValue = closure.dateSortValue;
}
