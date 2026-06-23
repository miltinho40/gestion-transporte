import { Injectable } from '@angular/core';
import Swal from 'sweetalert2/dist/sweetalert2.esm.js';

interface ConfirmOptions {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: 'warning' | 'question' | 'info' | 'success' | 'error';
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
}
