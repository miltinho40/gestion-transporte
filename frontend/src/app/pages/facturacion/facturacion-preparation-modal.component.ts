import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { LucideSave, LucideCopy, LucideX } from '@lucide/angular';
import Swal from 'sweetalert2';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { FacturarAFieldComponent } from '../../shared/facturar-a-field.component';
import { FacturacionApiService } from './facturacion-api.service';
import type {
  BillingPayload,
  Cliente,
  Draft,
  Invoice,
  ModalidadComision,
  Preview,
  Trip
} from './facturacion.models';
import {
  guides,
  key,
  money,
  orderedBillingRows,
  preparationGroups,
  selectionState,
  shortGuides,
  today,
  week
} from './facturacion.view-helpers';

@Component({
  selector: 'app-facturacion-preparation-modal',
  imports: [
    FormsModule,
    LucideSave,
    LucideCopy,
    LucideX,
    AutoDismissAlertDirective,
    FacturarAFieldComponent
  ],
  templateUrl: './facturacion-preparation-modal.component.html',
  styleUrl: './facturacion-preparation-modal.component.scss'
})
export class FacturacionPreparationModalComponent implements OnInit {
  private readonly api = inject(FacturacionApiService);
  readonly initialSelected = input<Trip[]>([]);
  readonly initialInvoice = input<Invoice | null>(null);
  readonly clientes = input<Cliente[]>([]);
  readonly selected = signal<Trip[]>([]);
  readonly closed = output<void>();
  readonly saved = output<boolean>();
  readonly changed = output<void>();
  readonly removed = output<Trip>();
  readonly money = money;
  readonly key = key;
  readonly today = today;
  readonly week = week;
  readonly guides = guides;
  readonly shortGuides = shortGuides;
  readonly orderedBillingRows = computed(() => orderedBillingRows(this.billingRows()));
  readonly billingGroups = computed(() => preparationGroups(this.billingRows(), this.preview()));
  private readonly destroyRef = inject(DestroyRef);

  private readonly calculationChanges = new Subject<void>();

  private calculationSequence = 0;

  readonly error = signal<string | null>(null);

  readonly busy = signal(false);

  readonly billingOpen = signal(false);

  readonly billingRows = signal<Trip[]>([]);

  readonly calculating = signal(false);

  readonly copyKeys = signal<Set<string>>(new Set());

  readonly billingMessage = signal<string | null>(null);

  readonly billingPrice = computed(
    () => this.billingRows().reduce((sum, t) => sum + Math.round(Number(t.precio) * 100), 0) / 100
  );

  readonly copyRows = computed(() =>
    this.billingRows().filter((t) => this.copyKeys().has(this.key(t)))
  );

  readonly drafts = signal<Draft[]>([]);

  draftId = '';

  draftVersion = 0;

  private draftSequence = 0;

  private recipientSequence = 0;

  readonly preview = signal<Preview | null>(null);

  recipient = '';

  number = '';

  date = this.today();

  commission = 0;

  ir = true;

  modalidad: ModalidadComision = 'AL_PAGAR';

  fail(e: any) {
    this.error.set(e?.error?.message ?? 'No se pudo completar la operación.');
    this.busy.set(false);
  }

  private invalidateCalculation() {
    this.calculationSequence++;
    this.preview.set(null);
    this.calculating.set(false);
  }

  resetPreview() {
    this.invalidateCalculation();
    if (this.billingOpen() && this.recipient && this.billingRows().length && !this.busy()) {
      this.calculating.set(true);
      this.calculationChanges.next();
    }
  }

  removeBillingTrip(trip: Trip) {
    if (this.busy()) return;
    const key = this.key(trip);
    this.billingRows.update((rows) => rows.filter((row) => this.key(row) !== key));
    this.selected.update((rows) => rows.filter((row) => this.key(row) !== key));
    this.removed.emit(trip);
    this.copyKeys.update((keys) => {
      const next = new Set(keys);
      next.delete(key);
      return next;
    });
    this.resetPreview();
    this.billingMessage.set(
      this.draftId
        ? 'Viaje quitado. Guarda el borrador para dejarlo disponible para facturar.'
        : 'Viaje quitado. Sigue disponible para facturar.'
    );
  }

  toggleCopy(trip: Trip) {
    this.copyKeys.update((keys) => {
      const next = new Set(keys),
        key = this.key(trip);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  setTripCommission(trip: Trip, value: number) {
    this.billingRows.update((rows) =>
      rows.map((row) =>
        this.key(row) === this.key(trip) ? { ...row, comision_cliente: Number(value) } : row
      )
    );
    this.resetPreview();
  }

  setTripIR(trip: Trip, value: boolean) {
    this.billingRows.update((rows) =>
      rows.map((row) => (this.key(row) === this.key(trip) ? { ...row, ir_cliente: value } : row))
    );
    this.resetPreview();
  }

  allForCopy() {
    return this.billingRows().length > 0 && this.copyRows().length === this.billingRows().length;
  }

  toggleAllForCopy() {
    this.copyKeys.set(
      this.allForCopy() ? new Set() : new Set(this.billingRows().map((t) => this.key(t)))
    );
  }

  groupCopyState(rows: { trip: Trip }[]) {
    return selectionState(
      rows.map((row) => row.trip),
      this.copyKeys()
    );
  }

  toggleGroupCopy(rows: { trip: Trip }[]) {
    const remove = this.groupCopyState(rows).all;
    this.copyKeys.update((keys) => {
      const next = new Set(keys);
      for (const row of rows) {
        const key = this.key(row.trip);
        if (remove) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  async copyLegend() {
    if (!this.copyRows().length) return;
    const text = this.orderedBillingRows()
      .filter((row) => this.copyKeys().has(this.key(row.trip)))
      .map(({ trip }) => `1 viaje a ${trip.destino} g#${trip.guias.join(', ') || '-'}`)
      .join('\n');
    try {
      try {
        if (!navigator.clipboard?.writeText) throw Error();
        await navigator.clipboard.writeText(text);
      } catch {
        const input = document.createElement('textarea');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        (document.querySelector('[aria-labelledby="billing-modal-title"]') ?? document.body).append(
          input
        );
        input.select();
        try {
          if (!document.execCommand('copy')) throw Error();
        } finally {
          input.remove();
        }
      }
      this.billingMessage.set(`Leyenda copiada: ${this.copyRows().length} viajes.`);
    } catch {
      this.error.set('No se pudo copiar la leyenda. Revisa los permisos del portapapeles.');
    }
  }

  chooseRecipient() {
    this.draftSequence++;
    this.draftId = '';
    this.draftVersion = 0;
    this.number = '';
    this.applyRecipientDefaults();
    this.resetPreview();
    this.loadDrafts();
  }

  private applyRecipientDefaults() {
    const config = this.clientes().find((c) => c.id === this.recipient)?.configuracion_facturacion;
    this.commission = Number(
      this.clientes().find((c) => c.id === this.recipient)?.porcentaje_comision ?? 0
    );
    this.ir = config?.ir_empresa ?? true;
    this.modalidad = config?.modalidad_comision ?? 'AL_PAGAR';
  }

  private loadDrafts() {
    const sequence = ++this.recipientSequence;
    this.drafts.set([]);
    if (!this.recipient) return;
    this.api
      .drafts(this.recipient)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (sequence === this.recipientSequence) this.drafts.set(r);
        },
        error: (e) => {
          if (sequence === this.recipientSequence) this.fail(e);
        }
      });
  }

  payload(): BillingPayload {
    return {
      destinatario_id: this.recipient,
      numero: this.number.trim(),
      fecha: this.date,
      comision_empresa: Number(this.commission),
      ir_empresa: this.ir,
      modalidad_comision: this.modalidad,
      factura_id: this.draftId || undefined,
      detalles: this.billingRows().map((t) => ({
        tipo: t.tipo,
        id: t.id,
        comision_cliente: Number(t.comision_cliente),
        ir_cliente: t.ir_cliente
      }))
    };
  }

  calculate() {
    if (!this.billingOpen() || !this.recipient || !this.billingRows().length || this.busy()) {
      this.calculating.set(false);
      return;
    }
    const sequence = this.calculationSequence;
    this.error.set(null);
    this.calculating.set(true);
    this.api
      .preview(this.payload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (sequence === this.calculationSequence && this.billingOpen()) {
            this.preview.set(r);
            this.calculating.set(false);
          }
        },
        error: (e) => {
          if (sequence === this.calculationSequence && this.billingOpen()) {
            this.calculating.set(false);
            this.fail(e);
          }
        }
      });
  }

  openBilling(existing?: Invoice) {
    if (!existing && !this.selected().length) return;
    this.recipient = existing?.destinatario.id ?? '';
    this.draftId = '';
    this.draftVersion = 0;
    this.number = '';
    this.date = this.today();
    this.applyRecipientDefaults();
    this.billingRows.set(existing ? [] : this.selected().map((t) => ({ ...t })));
    this.preview.set(null);
    this.error.set(null);
    this.billingOpen.set(true);
    this.copyKeys.set(new Set());
    this.billingMessage.set(null);
    this.invalidateCalculation();
    this.loadDrafts();
    if (existing) {
      this.draftId = existing.id;
      this.selectDraft();
    }
  }

  closeBilling() {
    if (this.busy()) return;
    this.draftSequence++;
    this.recipientSequence++;
    this.billingOpen.set(false);
    this.invalidateCalculation();
    this.closed.emit();
  }

  selectDraft() {
    this.invalidateCalculation();
    const sequence = ++this.draftSequence;
    this.copyKeys.set(new Set());
    if (!this.draftId) {
      this.draftVersion = 0;
      this.number = '';
      this.date = this.today();
      this.applyRecipientDefaults();
      this.billingRows.set(this.selected().map((t) => ({ ...t })));
      this.resetPreview();
      return;
    }
    this.busy.set(true);
    this.api
      .invoice(this.draftId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (f) => {
          if (sequence !== this.draftSequence) return;
          if (f.estado !== 'PREPARACION' || f.destinatario.id !== this.recipient) {
            this.error.set('La factura ya no está disponible para edición.');
            this.busy.set(false);
            return;
          }
          this.number = f.numero ?? '';
          this.date = f.fecha.slice(0, 10);
          this.commission = Number(f.comision_empresa);
          this.ir = f.ir_empresa;
          this.draftVersion = f.version;
          this.modalidad = f.modalidad_comision ?? 'AL_PAGAR';
          const rows = new Map(
            (f.viajes ?? []).map((t) => [
              this.key(t),
              { ...t, comision_cliente: Number(t.comision_cliente) }
            ])
          );
          for (const t of this.selected())
            if (!rows.has(this.key(t))) rows.set(this.key(t), { ...t });
          this.billingRows.set([...rows.values()]);
          this.busy.set(false);
          this.resetPreview();
        },
        error: (e) => this.fail(e)
      });
  }

  async saveBilling(close = false) {
    const p = this.preview();
    if (!p || this.busy() || this.calculating()) return;
    if (close) {
      const result = await Swal.fire({
        title: 'Cerrar factura',
        text: `A facturar: $ ${this.money(p.total_facturar)}. Neto: $ ${this.money(p.neto)}. No se podrán agregar más viajes.`,
        input: 'text',
        inputLabel: 'Número de factura',
        inputValue: this.number,
        inputAttributes: { maxlength: '80', autocomplete: 'off' },
        inputValidator: (value) => (!value.trim() ? 'Ingresa el número de factura.' : null),
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Cerrar factura',
        cancelButtonText: 'Cancelar'
      });
      if (!result.isConfirmed || this.busy() || this.destroyRef.destroyed) return;
      if (p !== this.preview() || this.calculating()) {
        this.error.set('Los valores cambiaron. Revisa los importes antes de cerrar.');
        return;
      }
      this.number = String(result.value).trim();
    }
    this.busy.set(true);
    const request = this.api.saveDraft(this.payload(), this.draftId, this.draftVersion);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (f) => {
        this.draftId = f.id;
        this.draftVersion = f.version;
        if (close) {
          this.api
            .closeInvoice(f.id, f.version, {
              neto_confirmado: Number(p.neto),
              total_facturar_confirmado: Number(p.total_facturar)
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.billingSaved(true),
              error: (e) => {
                this.changed.emit();
                this.resetPreview();
                this.fail(e);
              }
            });
        } else this.billingSaved(false);
      },
      error: (e) => {
        this.resetPreview();
        this.fail(e);
      }
    });
  }
  constructor() {
    this.calculationChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.calculate());
  }
  ngOnInit() {
    this.selected.set(this.initialSelected().map((trip) => ({ ...trip })));
    this.openBilling(this.initialInvoice() ?? undefined);
  }
  private billingSaved(closed: boolean) {
    this.busy.set(false);
    this.billingOpen.set(false);
    this.saved.emit(closed);
  }
}
