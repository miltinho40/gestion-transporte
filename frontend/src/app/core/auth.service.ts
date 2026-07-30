import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  tap
} from 'rxjs';
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
  private refreshRequest: Observable<LoginResponse> | null = null;

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
    this.persistSessionMetadata(session);
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
    this.persistSessionMetadata(session);
  }

  logout() {
    this.clearSession();
    this.http.post<void>(`${API_BASE_URL}/auth/logout`, {}).subscribe({
      error: () => undefined
    });
  }

  initializeSession() {
    return this.refreshSession().pipe(
      map(() => undefined),
      catchError(() => {
        this.clearSession();
        return of(undefined);
      })
    );
  }

  refreshSession() {
    if (this.refreshRequest) return this.refreshRequest;

    this.refreshRequest = this.http
      .post<LoginResponse>(`${API_BASE_URL}/auth/refresh`, {})
      .pipe(
        tap((response) => {
          if (!response.contexto) {
            throw new Error('La sesión no tiene un propietario activo');
          }
          this.setSession(response);
        }),
        finalize(() => {
          this.refreshRequest = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    return this.refreshRequest;
  }

  clearSession() {
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
      return parsed.contexto
        ? {
            token: null,
            usuario: parsed.usuario,
            contexto: parsed.contexto,
            propietarios: parsed.propietarios ?? []
          }
        : emptySession;
    } catch {
      return emptySession;
    }
  }

  private persistSessionMetadata(session: SessionState) {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...session,
        token: null
      })
    );
  }
}
