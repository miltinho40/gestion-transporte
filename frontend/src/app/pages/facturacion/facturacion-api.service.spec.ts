import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FacturacionApiService } from './facturacion-api.service';
import type { BillingPayload } from './facturacion.models';

describe('FacturacionApiService', () => {
  let api: FacturacionApiService;
  let http: HttpTestingController;
  const payload: BillingPayload = {
    destinatario_id: '2',
    numero: '',
    fecha: '2026-11-24',
    comision_empresa: 2,
    ir_empresa: true,
    modalidad_comision: 'AL_PAGAR',
    detalles: [{ tipo: 'propio', id: '1', comision_cliente: 3, ir_cliente: false }]
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    api = TestBed.inject(FacturacionApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('envía filtros y paginación al endpoint existente', () => {
    api
      .trips({
        search: 'OAA1227',
        page: 2,
        limit: 50,
        solo_propios: false,
        cliente_ids: '1,2',
        vehiculo_ids: '',
        semanas: '45,46'
      })
      .subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/facturacion/viajes'));
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('50');
    expect(request.request.params.get('cliente_ids')).toBe('1,2');
    expect(request.request.params.get('semanas')).toBe('45,46');
    expect(request.request.params.get('solo_propios')).toBe('false');
    request.flush({ items: [], total: 0 });
  });

  it('distingue crear borrador y actualizar con versión', () => {
    api.saveDraft(payload, '', 0).subscribe();
    const created = http.expectOne((req) => req.url.endsWith('/facturacion/borradores'));
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual(payload);
    created.flush({});
    api.saveDraft(payload, '9', 3).subscribe();
    const updated = http.expectOne((req) => req.url.endsWith('/facturacion/9/borrador'));
    expect(updated.request.method).toBe('PUT');
    expect(updated.request.body).toEqual({ ...payload, version: 3 });
    updated.flush({});
  });

  it('conserva versión e importes confirmados al cerrar', () => {
    api.closeInvoice('9', 4, { neto_confirmado: 940, total_facturar_confirmado: 1000 }).subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/facturacion/9/cerrar'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      version: 4,
      neto_confirmado: 940,
      total_facturar_confirmado: 1000
    });
    request.flush({});
  });

  it('mantiene abonos separados del pago al proveedor', () => {
    const payment = { fecha: '2026-11-24', monto: 100, soporte: 'TRANSFERENCIA' };
    api.payment('9', payment).subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/facturacion/9/abonos'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payment);
    request.flush({});
  });
});
