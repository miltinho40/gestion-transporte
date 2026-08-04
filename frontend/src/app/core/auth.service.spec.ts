import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import type { LoginResponse } from './models';

const response: LoginResponse = {
  token: 'access-token-solo-en-memoria',
  token_type: 'Bearer',
  expires_in: '15m',
  usuario: {
    id: '10',
    nombre: 'USUARIO TEST',
    email: 'usuario@example.test',
    es_super_admin: false
  },
  contexto: {
    propietario_id: '20',
    propietario_nombre: 'PROPIETARIO TEST',
    rol_id: '1',
    rol: 'admin',
    permisos: [],
    permisos_configurados: false
  },
  propietarios: []
};

const superAdminResponse: LoginResponse = {
  ...response,
  usuario: {
    ...response.usuario,
    id: '1',
    email: 'admin@local.test',
    es_super_admin: true
  },
  contexto: null
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('mantiene el access token fuera de localStorage', () => {
    service.login('usuario@example.test', 'ClaveSegura123!').subscribe();
    http.expectOne((request) => request.url.endsWith('/auth/login')).flush(response);

    expect(service.token()).toBe(response.token);
    const stored = JSON.parse(
      localStorage.getItem('gestion_transporte_session') ?? '{}'
    ) as { token?: string | null };
    expect(stored.token).toBeNull();
  });

  it('restaura la sesión mediante el endpoint de refresh', () => {
    service.initializeSession().subscribe();
    http.expectOne((request) => request.url.endsWith('/auth/refresh')).flush(response);

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.contexto()?.propietario_id).toBe('20');
  });

  it('mantiene autenticado al superadmin sin propietario activo', () => {
    service.login('admin@local.test', 'admin123456').subscribe();
    http.expectOne((request) => request.url.endsWith('/auth/login')).flush(superAdminResponse);

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.isSuperAdmin()).toBeTrue();
    expect(service.contexto()).toBeNull();
  });
});
