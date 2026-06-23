import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideKeyRound, LucideSave } from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';

interface ChangePasswordResponse {
  message: string;
}

@Component({
  selector: 'app-change-password-page',
  imports: [ReactiveFormsModule, LucideKeyRound, LucideSave, AutoDismissAlertDirective],
  templateUrl: './change-password-page.component.html',
  styleUrl: './change-password-page.component.scss'
})
export class ChangePasswordPageComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly userName = this.auth.usuario()?.nombre ?? 'Usuario';

  readonly form = this.fb.nonNullable.group({
    current_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required, Validators.minLength(8)]]
  });

  submit() {
    this.message.set(null);
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.getRawValue();

    if (payload.new_password !== payload.confirm_password) {
      this.form.controls.confirm_password.setErrors({ mismatch: true });
      this.error.set('La nueva clave y la confirmacion no coinciden.');
      return;
    }

    if (payload.current_password === payload.new_password) {
      this.form.controls.new_password.setErrors({ samePassword: true });
      this.error.set('La nueva clave debe ser diferente a la actual.');
      return;
    }

    this.loading.set(true);
    this.api.patch<ChangePasswordResponse>('/auth/password', payload).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.message.set(response.message);
        this.form.reset();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo cambiar la clave.');
      }
    });
  }
}
