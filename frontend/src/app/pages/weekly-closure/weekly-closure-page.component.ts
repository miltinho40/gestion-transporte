import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideCalculator,
  LucideCheck,
  LucideCopy,
  LucidePencil,
  LucideRefreshCw,
  LucideSparkles
} from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { formatDateOnly } from '../../core/date-only';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { DialogService } from '../../shared/dialog.service';

type EstadoViaje = 'programado' | 'en_curso' | 'completado' | 'cancelado';
type EstadoMantenimiento = 'programado' | 'realizado' | 'cancelado' | 'vencido';

interface VehiculoOption {
  id: string;
  placa: string;
  marca: string;
  modelo: string | null;
}

interface CierreSemanal {
  semana: {
    anio: number;
    numero_semana: number;
    fecha_inicio: string;
    fecha_fin: string;
  };
  vehiculo: {
    id: string;
    placa: string;
    marca: string;
    modelo: string | null;
  };
  resumen: {
    cantidad_viajes: number;
    cantidad_mantenimientos: number;
    cantidad_gastos_semanales: number;
    cantidad_gastos_generados: number;
    totales: Record<string, unknown>;
  };
  viajes: ViajeCierre[];
  mantenimientos: MantenimientoCierre[];
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
  revision_cierre?: {
    cerrado: boolean;
    cierre_id?: string;
    cerrado_en?: string;
    requiere_revision: boolean;
    diferencias: unknown[];
    total_diferencias: number;
  };
  asistente_cierre?: AsistenteCierre;
}

interface AsistenteCierre {
  disponible: boolean;
  riesgo: 'bajo' | 'medio' | 'alto';
  puntaje: number;
  total_alertas: number;
  resumen: string;
  alertas: AsistenteCierreAlerta[];
}

interface AsistenteCierreAlerta {
  id: string;
  tipo: string;
  severidad: 'info' | 'advertencia' | 'critica';
  titulo: string;
  mensaje: string;
  accion_sugerida: string;
  source_type?: 'viaje' | 'mantenimiento' | 'cierre' | null;
  source_id?: string | null;
}

interface ViajeCierre {
  id: string;
  fecha_salida: string;
  fecha_llegada?: string | null;
  cliente: { nombre: string; ruc_cedula: string };
  conductor: { nombre: string; cedula: string };
  ruta: { origen: string; destino: string };
  tipo_carga: { nombre: string };
  descripcion_carga?: string | null;
  numeros_guia_remision: string[];
  precio_flete: string | number;
  retorno_gastos_viaje: string | number;
  precio_real_flete: string | number;
  viaticos: string | number;
  utilidad: string | number;
  cobrado: boolean;
  retorno: boolean;
  estado: EstadoViaje;
}

interface MantenimientoCierre {
  id: string;
  fecha_mantenimiento: string;
  vehiculo: { id: string; placa: string; marca: string; modelo: string | null };
  tipo_mantenimiento: { nombre: string };
  descripcion?: string | null;
  costo_total: string | number;
  estado: EstadoMantenimiento;
}

interface ActividadSemanalItem {
  trackId: string;
  sourceId: string;
  sourceType: 'viaje' | 'mantenimiento';
  fecha: string;
  tipo: 'Viaje' | 'Retorno' | 'Mantenimiento';
  titulo: string;
  detalle: string;
  flete: string | number | null;
  fleteReal: string | number | null;
  viaticos: string | number | null;
  resultado: string | number | null;
  copyText: string | null;
  cobrado: boolean;
  estado: string;
  estadoClass: string;
  rowClass: string;
  sortTime: number;
}

const splitGuiasRemision = (values: string[]) =>
  values
    .flatMap((value) => String(value ?? '').split(/[\n,;-]+/))
    .map((item) => item.trim())
    .filter(Boolean);

const guiasReferencia = (guias: string[]) => guias.join(', ').slice(0, 10);

const todayInputDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

@Component({
  selector: 'app-weekly-closure-page',
  imports: [
    ReactiveFormsModule,
    LucideCalculator,
    LucideCheck,
    LucideCopy,
    LucidePencil,
    LucideRefreshCw,
    LucideSparkles,
    AutoDismissAlertDirective
  ],
  templateUrl: './weekly-closure-page.component.html'
})
export class WeeklyClosurePageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
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
    numero_semana: [this.isoWeek(new Date())],
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

    this.api.get<VehiculoOption[]>('/vehiculos', { solo_propios: true }).subscribe({
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
      this.error.set('Selecciona un vehículo para consultar el cierre semanal.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.clearMessage();
    this.consultedKey.set('');
    const { anio, numero_semana, vehiculo_id } = this.form.getRawValue();

    this.api.get<CierreSemanal>('/cierres-semanales', { anio, numero_semana, vehiculo_id }).subscribe({
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
      }
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
      .post<{ cierre: CierreSemanal }>('/cierres-semanales/generar-gastos', {
        anio,
        numero_semana,
        vehiculo_id
      })
      .subscribe({
        next: (response) => {
          this.cierre.set(response.cierre);
          this.noticeRefresh.update((value) => value + 1);
          this.consultedKey.set(this.currentConsultKey());
          this.showMessage(
            isRegeneration
              ? 'Gastos regenerados y cierre actualizado para el vehículo y semana.'
              : 'Gastos generados o actualizados para el vehículo y semana.'
          );
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

  semanaTerminada(cierre: CierreSemanal | null) {
    if (!cierre) return false;
    return this.dateSortValue(cierre.semana.fecha_fin) < this.todaySortValue();
  }

  gastosYaGenerados(cierre: CierreSemanal | null) {
    return Number(cierre?.resumen.cantidad_gastos_generados ?? 0) > 0;
  }

  cierreRequiereRevision(cierre: CierreSemanal | null) {
    return Boolean(cierre?.revision_cierre?.requiere_revision);
  }

  asistenteCierre(cierre: CierreSemanal | null) {
    return cierre?.asistente_cierre ?? null;
  }

  assistantRiskLabel(riesgo: AsistenteCierre['riesgo']) {
    const labels: Record<AsistenteCierre['riesgo'], string> = {
      bajo: 'Bajo',
      medio: 'Medio',
      alto: 'Alto'
    };

    return labels[riesgo] ?? riesgo;
  }

  assistantRiskClass(riesgo: AsistenteCierre['riesgo']) {
    const classes: Record<AsistenteCierre['riesgo'], string> = {
      bajo: 'weekly-assistant-risk-low',
      medio: 'weekly-assistant-risk-medium',
      alto: 'weekly-assistant-risk-high'
    };

    return classes[riesgo] ?? classes.bajo;
  }

  assistantSeverityLabel(severidad: AsistenteCierreAlerta['severidad']) {
    const labels: Record<AsistenteCierreAlerta['severidad'], string> = {
      info: 'Info',
      advertencia: 'Advertencia',
      critica: 'Crítica'
    };

    return labels[severidad] ?? severidad;
  }

  assistantSeverityClass(severidad: AsistenteCierreAlerta['severidad']) {
    const classes: Record<AsistenteCierreAlerta['severidad'], string> = {
      info: 'text-bg-light',
      advertencia: 'badge-soft-warning',
      critica: 'text-bg-danger'
    };

    return classes[severidad] ?? classes.info;
  }

  generatedNoticeKey(cierre: CierreSemanal) {
    return [
      cierre.vehiculo.id,
      cierre.semana.anio,
      cierre.semana.numero_semana,
      cierre.resumen.cantidad_gastos_generados,
      this.noticeRefresh()
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

  money(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : value ?? '0';
  }

  moneyOrDash(value: unknown) {
    if (value === null || value === undefined || value === '') return '-';
    return `$ ${this.money(value)}`;
  }

  dateOnly(value: unknown) {
    return formatDateOnly(value);
  }

  vehiculoLabel(vehiculo: VehiculoOption | CierreSemanal['vehiculo']) {
    return `${vehiculo.placa} - ${vehiculo.marca}${vehiculo.modelo ? ` ${vehiculo.modelo}` : ''}`;
  }

  transportistaLabel(cierre: CierreSemanal) {
    const nombres = [...new Set((cierre.conductores ?? []).map((item) => item.conductor.nombre).filter(Boolean))];
    return nombres.length ? nombres.join(', ') : '-';
  }

  totalSueldoSemanal(cierre: CierreSemanal) {
    return cierre.resumen.totales['sueldos_sugeridos'];
  }

  totalBonos(cierre: CierreSemanal) {
    return cierre.resumen.totales['bonificaciones_sugeridas'];
  }

  totalSueldoBonos(cierre: CierreSemanal) {
    return this.numberValue(this.totalSueldoSemanal(cierre)) + this.numberValue(this.totalBonos(cierre));
  }

  totalSemanaReporte(cierre: CierreSemanal) {
    return (
      this.numberValue(this.totalSueldoSemanal(cierre)) +
      this.numberValue(this.totalBonos(cierre)) +
      this.totalGastoRetornoRetornos(cierre) +
      this.totalGastoRetornoDomingos(cierre)
    );
  }

  totalPrecioViajes(cierre: CierreSemanal) {
    return (cierre.viajes ?? []).reduce(
      (total, viaje) => total + this.numberValue(viaje.precio_flete),
      0
    );
  }

  gananciaSemanal(cierre: CierreSemanal) {
    if (this.gastosYaGenerados(cierre)) {
      return this.numberValue(cierre.resumen.totales['resultado_operativo']);
    }

    return (
      this.numberValue(cierre.resumen.totales['utilidad']) -
      this.numberValue(cierre.resumen.totales['mantenimientos']) -
      this.numberValue(cierre.resumen.totales['gastos_semanales']) -
      this.totalSueldoBonos(cierre)
    );
  }

  cantidadRetornos(cierre: CierreSemanal) {
    return (cierre.viajes ?? []).filter((viaje) => viaje.retorno).length;
  }

  totalGastoRetornoRetornos(cierre: CierreSemanal) {
    return this.totalGastoRetornoViajes(cierre, (viaje) => viaje.retorno);
  }

  cantidadDomingos(cierre: CierreSemanal) {
    return (cierre.viajes ?? []).filter((viaje) => this.viajeEntregaDomingo(viaje)).length;
  }

  totalGastoRetornoDomingos(cierre: CierreSemanal) {
    return this.totalGastoRetornoViajes(cierre, (viaje) => this.viajeEntregaDomingo(viaje));
  }

  gananciaSemanalClass(cierre: CierreSemanal) {
    return this.gananciaSemanal(cierre) >= 0
      ? 'weekly-summary-card-info'
      : 'weekly-summary-card-danger';
  }

  actividadSemanal(cierre: CierreSemanal): ActividadSemanalItem[] {
    const viajes = (cierre.viajes ?? []).map((viaje) => {
      const guiasRemision = splitGuiasRemision(viaje.numeros_guia_remision ?? []);
      const guias = guiasRemision.length
        ? `Guías: ${guiasReferencia(guiasRemision)}`
        : null;

      return {
        trackId: `viaje-${viaje.id}`,
        sourceId: viaje.id,
        sourceType: 'viaje' as const,
        fecha: this.dateOnly(this.fechaSemanaViaje(viaje)),
        tipo: viaje.retorno ? 'Retorno' as const : 'Viaje' as const,
        titulo: `${viaje.ruta.origen} - ${viaje.ruta.destino}`,
        detalle: [viaje.cliente.nombre, viaje.conductor.nombre, guias].filter(Boolean).join(' | '),
        flete: viaje.precio_flete,
        fleteReal: viaje.precio_real_flete,
        viaticos: viaje.viaticos,
        resultado: viaje.utilidad,
        copyText: this.viajeCopyText(viaje, guiasRemision),
        cobrado: viaje.cobrado,
        estado: this.estadoViajeLabel(viaje.estado),
        estadoClass: 'badge-soft',
        rowClass: viaje.cobrado ? 'weekly-activity-row-cobrado' : '',
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
      flete: null,
      fleteReal: null,
      viaticos: null,
      resultado: mantenimiento.costo_total,
      copyText: null,
      cobrado: false,
      estado: this.estadoMantenimientoLabel(mantenimiento.estado),
      estadoClass: 'badge-soft-warning',
      rowClass: 'weekly-activity-row-mantenimiento',
      sortTime: this.dateSortValue(mantenimiento.fecha_mantenimiento)
    }));

    const sortByDate = (left: ActividadSemanalItem, right: ActividadSemanalItem) => {
      if (left.sortTime !== right.sortTime) return left.sortTime - right.sortTime;
      return left.titulo.localeCompare(right.titulo);
    };

    return [...viajes.sort(sortByDate), ...mantenimientos.sort(sortByDate)];
  }

  editarActividad(item: ActividadSemanalItem) {
    const route = item.sourceType === 'viaje' ? '/app/reportes' : '/app/mantenimientos';
    void this.router.navigate([route], {
      queryParams: {
        edit: item.sourceId,
        returnUrl: this.cierreReturnUrl()
      }
    });
  }

  editarAlertaAsistente(alerta: AsistenteCierreAlerta) {
    if (!alerta.source_id || (alerta.source_type !== 'viaje' && alerta.source_type !== 'mantenimiento')) {
      return;
    }

    const route = alerta.source_type === 'viaje' ? '/app/reportes' : '/app/mantenimientos';
    void this.router.navigate([route], {
      queryParams: {
        edit: alerta.source_id,
        returnUrl: this.cierreReturnUrl()
      }
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
      defaultDate: todayInputDate()
    });
    if (!support) return;

    this.markingCobroId.set(item.sourceId);
    this.error.set(null);
    this.clearMessage();

    this.api
      .patch(`/viajes/${item.sourceId}/cobro`, {
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

  private estadoViajeLabel(estado: EstadoViaje) {
    const labels: Record<EstadoViaje, string> = {
      programado: 'Programado',
      en_curso: 'En curso',
      completado: 'Completado',
      cancelado: 'Cancelado'
    };

    return labels[estado] ?? estado;
  }

  private estadoMantenimientoLabel(estado: EstadoMantenimiento) {
    const labels: Record<EstadoMantenimiento, string> = {
      programado: 'Programado',
      realizado: 'Realizado',
      cancelado: 'Cancelado',
      vencido: 'Vencido'
    };

    return labels[estado] ?? estado;
  }

  private viajeCopyText(viaje: ViajeCierre, guiasRemision: string[]) {
    return `1 viaje a ${viaje.ruta.destino} g#${guiasRemision.join(', ') || '-'}`;
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
        queryParams: { anio, numero_semana, vehiculo_id }
      })
    );
  }

  private dateSortValue(value: unknown) {
    const date = this.dateOnly(value);
    const timestamp = Date.parse(`${date}T00:00:00.000Z`);

    return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
  }

  private isSunday(value: unknown) {
    const date = this.dateOnly(value);
    const timestamp = Date.parse(`${date}T00:00:00.000Z`);

    return Number.isFinite(timestamp) && new Date(timestamp).getUTCDay() === 0;
  }

  private viajeEntregaDomingo(viaje: ViajeCierre) {
    return this.isSunday(viaje.fecha_llegada || viaje.fecha_salida);
  }

  private fechaSemanaViaje(viaje: ViajeCierre) {
    return viaje.fecha_llegada || viaje.fecha_salida;
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

  private semanaFutura(cierre: CierreSemanal) {
    return this.dateSortValue(cierre.semana.fecha_inicio) > this.todaySortValue();
  }

  private createWeeklyReportImage(cierre: CierreSemanal) {
    const width = 1080;
    const scale = 2;
    const padding = 44;
    const tableWidth = width - padding * 2;
    const colFecha = 126;
    const colTipo = 150;
    const colPrecio = 168;
    const colDetalle = tableWidth - colFecha - colTipo - colPrecio;
    const tableColumns = [
      { label: 'Fecha', width: colFecha },
      { label: 'Tipo', width: colTipo },
      { label: 'Detalle', width: colDetalle },
      { label: 'Precio de viaje', width: colPrecio }
    ];

    const viajes = [...(cierre.viajes ?? [])].sort(
      (left, right) => this.dateSortValue(this.fechaSemanaViaje(left)) - this.dateSortValue(this.fechaSemanaViaje(right))
    );
    const measureCanvas = document.createElement('canvas');
    const measureContext = this.getCanvasContext(measureCanvas);
    measureContext.font = '24px Inter, Arial, sans-serif';

    const rows = viajes.map((viaje) => {
      const detailLines = this.wrapCanvasText(
        measureContext,
        this.viajeDetalleReporte(viaje),
        colDetalle - 24
      );

      return {
        viaje,
        detailLines,
        height: Math.max(48, detailLines.length * 24 + 22)
      };
    });

    const headerHeight = 104;
    const summaryHeight = 200;
    const sectionTitleHeight = 42;
    const tableHeaderHeight = 44;
    const emptyHeight = viajes.length ? 0 : 58;
    const totalHeight = 56;
    const tableRowsHeight = rows.reduce((total, row) => total + row.height, 0) + emptyHeight;
    const height =
      padding * 2 + headerHeight + 28 + summaryHeight + 34 + sectionTitleHeight + tableHeaderHeight + tableRowsHeight + totalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = this.getCanvasContext(canvas);
    context.scale(scale, scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    this.drawRoundedRect(context, 16, 16, width - 32, height - 32, 18, '#ffffff', '#d9e0e8');
    this.drawRoundedRect(context, padding, padding, tableWidth, headerHeight, 12, '#17324d');

    context.fillStyle = '#ffffff';
    context.textBaseline = 'alphabetic';
    context.font = '700 30px Inter, Arial, sans-serif';
    context.fillText(`Cierre semanal - Semana ${cierre.semana.numero_semana}`, padding + 24, padding + 42);
    context.font = '500 17px Inter, Arial, sans-serif';
    context.fillText(
      `${this.dateOnly(cierre.semana.fecha_inicio)} - ${this.dateOnly(cierre.semana.fecha_fin)}`,
      padding + 24,
      padding + 72
    );
    context.textAlign = 'right';
    context.fillText(this.vehiculoLabel(cierre.vehiculo), padding + tableWidth - 24, padding + 42);
    context.fillText(this.transportistaLabel(cierre), padding + tableWidth - 24, padding + 72);
    context.textAlign = 'left';

    let y = padding + headerHeight + 28;
    this.drawRoundedRect(context, padding, y, tableWidth, summaryHeight, 10, '#f8fafc', '#d9e0e8');
    const summaryRows = [
      ['Sueldo semanal:', `$ ${this.money(this.totalSueldoSemanal(cierre))}`],
      ['Bono:', `$ ${this.money(this.totalBonos(cierre))}`],
      [
        'Retornos:',
        `${this.cantidadRetornos(cierre)} viajes ($ ${this.money(this.totalGastoRetornoRetornos(cierre))})`
      ],
      [
        'Viajes domingo:',
        `${this.cantidadDomingos(cierre)} viajes ($ ${this.money(this.totalGastoRetornoDomingos(cierre))})`
      ],
      ['Total semana:', `$ ${this.money(this.totalSemanaReporte(cierre))}`]
    ];

    const summaryX = padding + 24;
    const summaryValueX = padding + tableWidth - 24;
    const summaryRowHeight = 34;
    let summaryY = y + 38;
    summaryRows.forEach(([label, value], index) => {
      const isTotal = index === summaryRows.length - 1;

      if (isTotal) {
        this.drawRoundedRect(
          context,
          padding + 14,
          summaryY - 25,
          tableWidth - 28,
          summaryRowHeight + 14,
          8,
          '#e7f6ec',
          '#b7dfc4'
        );
      }

      context.fillStyle = isTotal ? '#0f5132' : '#344054';
      context.font = `${isTotal ? '700' : '600'} 22px Inter, Arial, sans-serif`;
      context.fillText(label, summaryX, summaryY);
      context.textAlign = 'right';
      context.fillText(value, summaryValueX, summaryY);
      context.textAlign = 'left';
      summaryY += summaryRowHeight;
    });

    y += summaryHeight + 34;
    context.fillStyle = '#182230';
    context.font = '700 24px Inter, Arial, sans-serif';
    context.fillText('Viajes semanales', padding, y + 28);
    y += sectionTitleHeight;

    let x = padding;
    context.font = '700 15px Inter, Arial, sans-serif';
    tableColumns.forEach((column) => {
      this.drawTableCell(context, x, y, column.width, tableHeaderHeight, '#eef4ff', '#cbd5e1');
      context.fillStyle = '#344054';
      context.fillText(column.label, x + 12, y + 28);
      x += column.width;
    });
    y += tableHeaderHeight;

    if (!rows.length) {
      this.drawTableCell(context, padding, y, tableWidth, emptyHeight, '#ffffff', '#d9e0e8');
      context.fillStyle = '#667085';
      context.font = '500 18px Inter, Arial, sans-serif';
      context.fillText('Sin viajes registrados en esta semana.', padding + 18, y + 36);
      y += emptyHeight;
    }

    rows.forEach((row, index) => {
      const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      let cellX = padding;

      this.drawTableCell(context, cellX, y, colFecha, row.height, rowBg, '#d9e0e8');
      context.fillStyle = '#182230';
      context.font = '500 17px Inter, Arial, sans-serif';
      context.fillText(this.dateOnly(this.fechaSemanaViaje(row.viaje)), cellX + 12, y + 30);
      cellX += colFecha;

      this.drawTableCell(context, cellX, y, colTipo, row.height, rowBg, '#d9e0e8');
      context.fillStyle = '#0f766e';
      context.font = '700 16px Inter, Arial, sans-serif';
      context.fillText(this.tipoViajeReporte(row.viaje), cellX + 12, y + 30);
      cellX += colTipo;

      this.drawTableCell(context, cellX, y, colDetalle, row.height, rowBg, '#d9e0e8');
      context.fillStyle = '#182230';
      context.font = '500 17px Inter, Arial, sans-serif';
      this.drawWrappedCanvasText(context, row.detailLines, cellX + 12, y + 28, 24, colDetalle - 24);
      cellX += colDetalle;

      this.drawTableCell(context, cellX, y, colPrecio, row.height, rowBg, '#d9e0e8');
      context.fillStyle = '#182230';
      context.font = '700 17px Inter, Arial, sans-serif';
      context.textAlign = 'right';
      context.fillText(`$ ${this.money(row.viaje.precio_flete)}`, cellX + colPrecio - 12, y + 30);
      context.textAlign = 'left';

      y += row.height;
    });

    this.drawRoundedRect(context, padding, y, tableWidth, totalHeight, 0, '#e7f6ec', '#b7dfc4');
    context.fillStyle = '#0f5132';
    context.font = '700 21px Inter, Arial, sans-serif';
    context.fillText('Total viajes', padding + 18, y + 35);
    context.textAlign = 'right';
    context.fillText(`$ ${this.money(this.totalPrecioViajes(cierre))}`, padding + tableWidth - 18, y + 35);
    context.textAlign = 'left';

    return this.canvasToPngBlob(canvas);
  }

  private canvasToPngBlob(canvas: HTMLCanvasElement) {
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];

    if (!base64) {
      throw new Error('No se pudo generar la imagen.');
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: 'image/png' });
  }

  private async copyImageToClipboard(blob: Blob) {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        return false;
      }

      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return true;
    } catch {
      return false;
    }
  }

  private async shareImage(blob: Blob, fileName: string, cierre: CierreSemanal) {
    if (!navigator.share || !navigator.canShare) {
      return false;
    }

    const file = new File([blob], fileName, { type: 'image/png' });
    const shareData = {
      files: [file],
      title: `Cierre semanal ${cierre.semana.numero_semana}`,
      text: `Cierre semanal ${cierre.semana.numero_semana} - ${this.vehiculoLabel(cierre.vehiculo)}`
    };

    if (!navigator.canShare(shareData)) {
      return false;
    }

    await navigator.share(shareData);
    return true;
  }

  private downloadImage(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  private weeklyReportFileName(cierre: CierreSemanal) {
    const placa = cierre.vehiculo.placa.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return `cierre-semana-${cierre.semana.anio}-${cierre.semana.numero_semana}-${placa || 'vehiculo'}.png`;
  }

  private tipoViajeReporte(viaje: ViajeCierre) {
    const domingo = this.viajeEntregaDomingo(viaje);

    if (viaje.retorno && domingo) return 'Retorno / Domingo';
    if (viaje.retorno) return 'Retorno';
    if (domingo) return 'Domingo';

    return 'Viaje';
  }

  private viajeDetalleReporte(viaje: ViajeCierre) {
    return `${viaje.ruta.origen} - ${viaje.ruta.destino}`;
  }

  private getCanvasContext(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('No se pudo crear el contexto de imagen.');
    }

    return context;
  }

  private drawRoundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: string,
    stroke?: string
  ) {
    const safeRadius = Math.min(radius, width / 2, height / 2);

    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
    context.fillStyle = fill;
    context.fill();

    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 1;
      context.stroke();
    }
  }

  private drawTableCell(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
    stroke: string
  ) {
    context.fillStyle = fill;
    context.fillRect(x, y, width, height);
    context.strokeStyle = stroke;
    context.lineWidth = 1;
    context.strokeRect(x, y, width, height);
  }

  private wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;

      if (context.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = word;
        return;
      }

      current = next;
    });

    if (current) {
      lines.push(current);
    }

    return lines.length ? lines : ['-'];
  }

  private drawWrappedCanvasText(
    context: CanvasRenderingContext2D,
    lines: string[],
    x: number,
    y: number,
    lineHeight: number,
    maxWidth: number
  ) {
    lines.forEach((line, index) => {
      context.fillText(this.truncateCanvasText(context, line, maxWidth), x, y + index * lineHeight);
    });
  }

  private truncateCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
    if (context.measureText(text).width <= maxWidth) {
      return text;
    }

    let truncated = text;

    while (truncated.length > 1 && context.measureText(`${truncated}...`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }

    return `${truncated}...`;
  }

  private currentConsultKey() {
    const { anio, numero_semana, vehiculo_id } = this.form.getRawValue();
    return `${anio}:${numero_semana}:${vehiculo_id}`;
  }

  private todaySortValue() {
    const now = new Date();
    return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private totalGastoRetornoViajes(cierre: CierreSemanal, predicate: (viaje: ViajeCierre) => boolean) {
    return (cierre.viajes ?? [])
      .filter(predicate)
      .reduce((total, viaje) => total + this.numberValue(viaje.retorno_gastos_viaje), 0);
  }

  private numberValue(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private isoWeek(date: Date) {
    const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
