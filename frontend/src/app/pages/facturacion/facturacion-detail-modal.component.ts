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
import { LucidePlus, LucidePencil } from '@lucide/angular';
import Swal from 'sweetalert2';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { FacturacionApiService } from './facturacion-api.service';
import type { Invoice } from './facturacion.models';
import { invoiceGroups, key, modalidadName, money, today, week } from './facturacion.view-helpers';

@Component({
  selector: 'app-facturacion-detail-modal',
  imports: [FormsModule, LucidePlus, LucidePencil, AutoDismissAlertDirective],
  templateUrl: './facturacion-detail-modal.component.html',
  styleUrl: './facturacion-detail-modal.component.scss'
})
export class FacturacionDetailModalComponent implements OnInit {
  private readonly api = inject(FacturacionApiService);
  readonly invoice = input.required<Invoice>();
  readonly canWrite = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly continuePreparation = output<Invoice>();
  readonly key = key;
  readonly money = money;
  readonly today = today;
  readonly week = week;
  readonly modalidadName = modalidadName;
  readonly invoiceGroups = computed(() => invoiceGroups(this.detail()));
  private readonly destroyRef = inject(DestroyRef);

  readonly error = signal<string | null>(null);

  readonly busy = signal(false);

  readonly detail = signal<Invoice | null>(null);

  readonly invoiceLoading = signal(false);

  readonly paymentError = signal<string | null>(null);

  abonoMonto = 0;

  abonoFecha = this.today();

  abonoSoporte = '';

  abonoTotal = false;

  fail(e: any) {
    this.error.set(e?.error?.message ?? 'No se pudo completar la operación.');
    this.busy.set(false);
  }

  openInvoice(invoice: Invoice) {
    this.error.set(null);
    this.paymentError.set(null);
    this.detail.set(invoice);
    this.abonoMonto = 0;
    this.abonoFecha = this.today();
    this.abonoSoporte = '';
    this.abonoTotal = false;
    this.invoiceLoading.set(true);
    this.api
      .invoice(invoice.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (f) => {
          if (this.detail()?.id === invoice.id) {
            this.detail.set(f);
            this.invoiceLoading.set(false);
          }
        },
        error: (e) => {
          if (this.detail()?.id === invoice.id) {
            this.invoiceLoading.set(false);
            this.fail(e);
          }
        }
      });
  }

  setFullPayment(checked: boolean) {
    this.abonoTotal = checked;
    this.abonoMonto = checked ? Number(this.detail()?.saldo ?? 0) : 0;
  }

  async addPayment() {
    const invoice = this.detail();
    if (!invoice || this.invoiceLoading() || this.busy()) return;
    this.paymentError.set(null);
    if (
      !this.abonoSoporte.trim() ||
      !Number.isFinite(Number(this.abonoMonto)) ||
      this.abonoMonto <= 0
    ) {
      this.paymentError.set('Ingresa un importe positivo y el número de soporte del abono.');
      return;
    }
    if (Number(this.abonoMonto) > Number(invoice.saldo)) {
      this.paymentError.set('El abono supera el saldo pendiente.');
      return;
    }
    if (!this.abonoFecha || this.abonoFecha < invoice.fecha.slice(0, 10)) {
      this.paymentError.set('La fecha del abono no puede ser anterior a la factura.');
      return;
    }
    const result = await Swal.fire({
      title: '¿Registrar abono?',
      text: `$ ${this.money(this.abonoMonto)} para la factura ${invoice.numero}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Registrar',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed || this.destroyRef.destroyed) return;
    this.busy.set(true);
    this.api
      .payment(invoice.id, {
        fecha: this.abonoFecha,
        monto: Number(this.abonoMonto),
        soporte: this.abonoSoporte
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.detail.set(null);
          this.saved.emit();
        },
        error: (e) => {
          this.busy.set(false);
          if (this.detail()?.id === invoice.id)
            this.paymentError.set(e?.error?.message ?? 'No se pudo registrar el abono.');
        }
      });
  }
  ngOnInit() {
    this.openInvoice(this.invoice());
  }
}
