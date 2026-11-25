import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProveedorTransporteApiService } from './proveedor-transporte-api.service';

describe('Proveedor: contratos HTTP', () => {
  let api: ProveedorTransporteApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    api = TestBed.inject(ProveedorTransporteApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('solicita catálogos solo del propietario activo', () => {
    api.clients().subscribe();
    api.providers().subscribe();
    api.prices().subscribe();
    for (const path of ['/clientes', '/proveedores', '/tarifas-ruta']) {
      const request = http.expectOne((req) => req.url.endsWith(path));
      expect(request.request.params.get('solo_propios')).toBe('true');
      request.flush([]);
    }
  });
  it('envía filtros y ocultamiento de finalizados al backend antes de paginar', () => {
    api
      .list({
        search: 'Vinces',
        page: 2,
        limit: 50,
        cliente_ids: '1,2',
        proveedor_ids: '3,4',
        mostrar_finalizados: false
      })
      .subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/viajes-proveedor'));
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('50');
    expect(request.request.params.get('mostrar_finalizados')).toBe('false');
    expect(request.request.params.get('cliente_ids')).toBe('1,2');
    request.flush({ data: [], meta: {} });
  });
  it('pago y cobro mantienen endpoints y soportes independientes', () => {
    const support = { fecha: '2026-11-24', soporte: null, sin_factura: true };
    api.support('10', 'pago', support).subscribe();
    const payment = http.expectOne((req) => req.url.endsWith('/viajes-proveedor/10/pago'));
    expect(payment.request.method).toBe('PATCH');
    expect(payment.request.body).toEqual(support);
    payment.flush({});
    api.support('10', 'cobro', support).subscribe();
    const collection = http.expectOne((req) => req.url.endsWith('/viajes-proveedor/10/cobro'));
    expect(collection.request.body).toEqual(support);
    collection.flush({});
    api.revertCollection('10').subscribe();
    const reversal = http.expectOne((req) => req.url.endsWith('/viajes-proveedor/10/cobro'));
    expect(reversal.request.body).toEqual({ cobrado: false });
    reversal.flush({});
  });
  it('envía las guías tal como se escriben para que el backend las normalice', () => {
    api.guides('10', '123,456-789').subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/viajes-proveedor/10/guias'));
    expect(request.request.body).toEqual({ numeros_guia_remision: '123,456-789' });
    request.flush({});
  });
});
