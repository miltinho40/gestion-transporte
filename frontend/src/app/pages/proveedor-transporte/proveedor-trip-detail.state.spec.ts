import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ProveedorTransporteApiService } from './proveedor-transporte-api.service';
import { ProveedorTripDetailState } from './proveedor-trip-detail.state';
import type { ProveedorViajeDetail } from './proveedor-viaje-detail-panel.component';

describe('Proveedor: estado del detalle por página', () => {
  let api: jasmine.SpyObj<ProveedorTransporteApiService>;
  let state: ProveedorTripDetailState;
  let requests: Map<string, Subject<ProveedorViajeDetail>>;
  beforeEach(() => {
    requests = new Map();
    api = jasmine.createSpyObj('api', ['detail']);
    api.detail.and.callFake((id) => {
      const response = new Subject<ProveedorViajeDetail>();
      requests.set(id, response);
      return response;
    });
    TestBed.configureTestingModule({
      providers: [
        ProveedorTripDetailState,
        { provide: ProveedorTransporteApiService, useValue: api }
      ]
    });
    state = TestBed.inject(ProveedorTripDetailState);
  });
  it('ignora respuestas tardías de otro viaje y no las vuelve a guardar en caché', () => {
    state.show('1');
    state.show('2');
    const second = { id: '2' } as ProveedorViajeDetail;
    requests.get('2')!.next(second);
    requests.get('1')!.next({ id: '1' } as ProveedorViajeDetail);
    expect(state.viaje()).toBe(second);
    state.show('1');
    expect(api.detail).toHaveBeenCalledTimes(3);
  });
  it('cerrar no permite que una respuesta pendiente vuelva a abrir el detalle', () => {
    state.show('1');
    state.close();
    requests.get('1')!.next({ id: '1' } as ProveedorViajeDetail);
    expect(state.open()).toBeFalse();
    expect(state.viaje()).toBeNull();
  });
  it('recargar la lista invalida la caché de detalle', () => {
    state.show('1');
    requests.get('1')!.next({ id: '1' } as ProveedorViajeDetail);
    state.close();
    state.show('1');
    expect(api.detail).toHaveBeenCalledTimes(1);
    state.reset();
    state.show('1');
    expect(api.detail).toHaveBeenCalledTimes(2);
  });
});
