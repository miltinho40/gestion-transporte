import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { WeeklyClosureApiService } from './weekly-closure-api.service';

describe('WeeklyClosureApiService', () => {
  let api: jasmine.SpyObj<ApiService>;
  let service: WeeklyClosureApiService;
  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch']);
    api.get.and.returnValue(of({}));
    api.post.and.returnValue(of({}));
    api.patch.and.returnValue(of({}));
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
    service = TestBed.inject(WeeklyClosureApiService);
  });
  it('pide únicamente vehículos propios', () => {
    service.listVehiculos().subscribe();
    expect(api.get).toHaveBeenCalledWith('/vehiculos', { solo_propios: true });
  });
  it('comparte los filtros exactos entre consulta y generación', () => {
    const filters = { anio: 2026, numero_semana: 25, vehiculo_id: '1' };
    service.getCierre(filters).subscribe();
    service.generarGastos(filters).subscribe();
    expect(api.get).toHaveBeenCalledWith('/cierres-semanales', filters);
    expect(api.post).toHaveBeenCalledWith('/cierres-semanales/generar-gastos', filters);
  });
  it('conserva fecha y soporte al cobrar, y la cadena de guías al agregarlas', () => {
    const input = {
      cobrado: true as const,
      fecha_cobro: '2026-06-22',
      soporte_cobro: '001',
      sin_factura_cobro: false,
    };
    service.marcarCobrado('10', input).subscribe();
    service.guardarGuias('10', '123, 456-789').subscribe();
    expect(api.patch).toHaveBeenCalledWith('/viajes/10/cobro', input);
    expect(api.patch).toHaveBeenCalledWith('/viajes/10/guias', {
      numeros_guia_remision: '123, 456-789',
    });
  });
});
