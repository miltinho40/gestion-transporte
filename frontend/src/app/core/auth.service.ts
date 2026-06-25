import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE_URL } from './api.config';
import type { AuthContext, AuthUser, LoginResponse, PropietarioAcceso } from './models';

interface SessionState {
  token: string | null;
  usuario: AuthUser | null;
  contexto: AuthContext | null;
  propietarios: PropietarioAcceso[];
}

const emptySession: SessionState = {
  token: null,
  usuario: null,
  contexto: null,
  propietarios: []
};

const storageKey = 'gestion_transporte_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly state = signal<SessionState>(this.restoreSession());

  readonly token = computed(() => this.state().token);
  readonly usuario = computed(() => this.state().usuario);
  readonly contexto = computed(() => this.state().contexto);
  readonly propietarios = computed(() => this.state().propietarios);
  readonly isAuthenticated = computed(() => Boolean(this.state().token && this.state().contexto));
  readonly isSuperAdmin = computed(() => Boolean(this.state().usuario?.es_super_admin));
  readonly requiresPasswordChange = computed(() => Boolean(this.state().usuario?.requiere_password));
  readonly hasOwnFleet = computed(
    () => this.isSuperAdmin() || this.state().contexto?.es_propietario !== false
  );
  readonly isIntermediary = computed(
    () => this.isSuperAdmin() || Boolean(this.state().contexto?.es_intermediario)
  );

  login(email: string, password: string, propietarioId?: string) {
    return this.http
      .post<LoginResponse>(`${API_BASE_URL}/auth/login`, {
        email,
        password,
        propietario_id: propietarioId || undefined
      })
      .pipe(
        tap((response) => {
          if (response.contexto) {
            this.setSession(response);
          }
        })
      );
  }

  setSession(response: LoginResponse) {
    const session: SessionState = {
      token: response.token,
      usuario: response.usuario,
      contexto: response.contexto,
      propietarios: response.propietarios
    };
    this.state.set(session);
    localStorage.setItem(storageKey, JSON.stringify(session));
  }

  markPasswordChanged() {
    const current = this.state();
    if (!current.usuario) return;

    const session: SessionState = {
      ...current,
      usuario: {
        ...current.usuario,
        requiere_password: false
      }
    };

    this.state.set(session);
    localStorage.setItem(storageKey, JSON.stringify(session));
  }

  logout() {
    this.state.set(emptySession);
    localStorage.removeItem(storageKey);
  }

  hasMenuPermission(permission: string) {
    if (this.isSuperAdmin()) return true;

    const context = this.state().contexto;
    if (!context?.permisos_configurados) return true;

    return context.permisos?.includes(permission) ?? false;
  }

  private restoreSession(): SessionState {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return emptySession;

    try {
      const parsed = JSON.parse(raw) as SessionState;
      return parsed.token && parsed.contexto ? parsed : emptySession;
    } catch {
      return emptySession;
    }
  }
}
