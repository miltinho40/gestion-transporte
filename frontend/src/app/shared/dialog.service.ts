import { Injectable } from '@angular/core';
import Swal from 'sweetalert2/dist/sweetalert2.esm.js';

interface ConfirmOptions {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: 'warning' | 'question' | 'info' | 'success' | 'error';
}

interface SupportPromptOptions {
  title: string;
  text?: string;
  dateLabel?: string;
  supportLabel?: string;
  noInvoiceLabel?: string;
  confirmText?: string;
  defaultDate?: string;
}

export interface SupportPromptResult {
  fecha: string;
  soporte: string | null;
  sin_factura: boolean;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  async confirm(options: ConfirmOptions) {
    const result = await Swal.fire({
      title: options.title,
      text: options.text,
      icon: options.icon ?? 'warning',
      showCancelButton: true,
      confirmButtonText: options.confirmText ?? 'Confirmar',
      cancelButtonText: options.cancelText ?? 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
      heightAuto: false,
      buttonsStyling: false,
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-outline-secondary me-2',
        popup: 'app-alert-modal'
      }
    });

    return result.isConfirmed;
  }

  async supportPrompt(options: SupportPromptOptions): Promise<SupportPromptResult | null> {
    const now = new Date();
    const defaultDate =
      options.defaultDate ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;
    const result = await Swal.fire<SupportPromptResult>({
      title: options.title,
      text: options.text,
      icon: 'question',
      html: `
        <div class="text-start">
          <label class="form-label" for="support-date">${options.dateLabel ?? 'Fecha'}</label>
          <input id="support-date" class="form-control mb-3" type="date" value="${defaultDate}">

          <label class="form-label" for="support-number">${options.supportLabel ?? 'Factura / soporte'}</label>
          <input id="support-number" class="form-control mb-3" type="text" maxlength="80" autocomplete="off">

          <div class="form-check">
            <input id="support-no-invoice" class="form-check-input" type="checkbox">
            <label class="form-check-label" for="support-no-invoice">
              ${options.noInvoiceLabel ?? 'No se emitio factura'}
            </label>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: options.confirmText ?? 'Confirmar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
      heightAuto: false,
      buttonsStyling: false,
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-outline-secondary me-2',
        popup: 'app-alert-modal'
      },
      preConfirm: () => {
        const fecha = (document.getElementById('support-date') as HTMLInputElement | null)?.value;
        const soporte = (document.getElementById('support-number') as HTMLInputElement | null)?.value.trim();
        const sinFactura = Boolean(
          (document.getElementById('support-no-invoice') as HTMLInputElement | null)?.checked
        );

        if (!fecha) {
          Swal.showValidationMessage('Selecciona la fecha.');
          return false;
        }

        if (!sinFactura && !soporte) {
          Swal.showValidationMessage('Ingresa el numero de factura/soporte o marca que no se emitio factura.');
          return false;
        }

        return {
          fecha,
          soporte: sinFactura ? null : soporte || null,
          sin_factura: sinFactura
        };
      }
    });

    return result.isConfirmed ? result.value ?? null : null;
  }
}
