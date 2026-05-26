import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideKeyRound, LucideTruck } from '@lucide/angular';
import { API_BASE_URL } from '../../core/api.config';

@Component({
  selector: 'app-accept-invitation-page',
  imports: [ReactiveFormsModule, RouterLink, LucideKeyRound, LucideTruck],
  templateUrl: './accept-invitation-page.component.html',
  styleUrl: '../login/login-page.component.scss'
})
export class AcceptInvitationPageComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly token = signal(this.route.snapshot.queryParamMap.get('token') ?? '');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly hasToken = computed(() => Boolean(this.token()));

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required, Validators.minLength(8)]]
  });

  submit() {
    this.error.set(null);
    this.message.set(null);

    if (!this.hasToken()) {
      this.error.set('El enlace de invitación no es válido.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { password, confirm_password } = this.form.getRawValue();
    if (password !== confirm_password) {
      this.error.set('Las claves no coinciden.');
      return;
    }

    this.loading.set(true);
    this.http
      .post<{ message: string }>(`${API_BASE_URL}/auth/aceptar-invitacion`, {
        token: this.token(),
        password
      })
      .subscribe({
        next: (response) => {
          this.loading.set(false);
          this.message.set(response.message);
          this.form.reset();
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo crear la clave.');
        }
      });
  }
}
