import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideLogIn, LucideTruck } from '@lucide/angular';
import { AuthService } from '../../core/auth.service';
import type { PropietarioAcceso } from '../../core/models';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, LucideLogIn, LucideTruck],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly propietarios = signal<PropietarioAcceso[]>([]);
  readonly needsOwner = computed(() => this.propietarios().length > 0);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    propietario_id: ['']
  });

  submit() {
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password, propietario_id } = this.form.getRawValue();

    this.loading.set(true);
    this.auth.login(email, password, propietario_id || undefined).subscribe({
      next: (response) => {
        this.loading.set(false);

        if (response.contexto) {
          void this.router.navigate(['/app/dashboard']);
          return;
        }

        if (response.propietarios.length) {
          this.propietarios.set(response.propietarios);
          this.form.controls.propietario_id.setValue(response.propietarios[0]?.id ?? '');
          return;
        }

        this.error.set('El usuario no tiene propietarios disponibles para operar.');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo iniciar sesión.');
      }
    });
  }
}
