import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProveedorViajeEditorModalComponent } from './proveedor-viaje-editor-modal.component';
import { ProveedorTransporteApiService } from './proveedor-transporte-api.service';
import { providerTripFixture } from './proveedor-transporte.testing';
import { todayInputDate, tomorrowInputDate } from './proveedor-transporte.helpers';
import type { ProveedorEditorRequest } from './proveedor-transporte.models';

describe('Proveedor: editor aislado', () => {
  const row = providerTripFixture();
  let api: jasmine.SpyObj<ProveedorTransporteApiService>;
  beforeEach(() => {
    api = jasmine.createSpyObj('ProveedorTransporteApiService', ['save']);
    api.save.and.returnValue(of(row));
    TestBed.configureTestingModule({
      providers: [{ provide: ProveedorTransporteApiService, useValue: api }]
    });
    TestBed.overrideComponent(ProveedorViajeEditorModalComponent, { set: { template: '' } });
  });
  const editor = (request: ProveedorEditorRequest) => {
    const fixture = TestBed.createComponent(ProveedorViajeEditorModalComponent);
    fixture.componentRef.setInput('request', request);
    fixture.componentRef.setInput('clientes', [row.cliente]);
    fixture.componentRef.setInput('proveedores', [row.proveedor]);
    fixture.componentRef.setInput('tarifasRuta', [row.tarifa_ruta]);
    fixture.detectChanges();
    return fixture;
  };

  it('mantiene las fechas e importes del viaje al editar', () => {
    const component = editor({ mode: 'edit', row }).componentInstance;
    expect(component.form.controls.fecha_salida.value).toBe('2026-11-05');
    expect(component.form.controls.fecha_llegada.value).toBe('2026-11-06');
    expect(component.form.controls.precio_pagar_proveedor.value).toBe(873);
    expect(component.form.controls.facturar_a_id.value).toBe('4');
  });

  it('duplicar conserva datos operativos y limpia fechas de cobro y pago', () => {
    const component = editor({ mode: 'duplicate', row }).componentInstance;
    const value = component.form.getRawValue();
    expect(component.editingRow()).toBeNull();
    expect(value.fecha_salida).toBe(todayInputDate());
    expect(value.fecha_llegada).toBe(tomorrowInputDate());
    expect(value.cobrado).toBeFalse();
    expect(value.pagado_proveedor).toBeFalse();
    expect(value.fecha_cobro).toBe('');
    expect(value.fecha_pago_proveedor).toBe('');
    expect(value.cliente_id).toBe(row.cliente_id);
    expect(value.numeros_guia_remision).toBe('123, 456');
  });

  it('no guarda un formulario incompleto', () => {
    editor({ mode: 'create' }).componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('conserva el contrato de guardado sin estado, cobro o valor de facturación', () => {
    const component = editor({ mode: 'edit', row }).componentInstance;
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);
    component.save();
    const [payload, id] = api.save.calls.mostRecent().args;
    expect(id).toBe(row.id);
    expect(payload.precio_pagar_proveedor).toBe(873);
    expect(payload.fecha_pago_proveedor).toBe('2026-11-10');
    for (const field of ['estado', 'cobrado', 'fecha_cobro', 'valor_a_facturar'])
      expect(field in payload).toBeFalse();
    expect(saved).toHaveBeenCalledWith('Viaje de proveedor actualizado.');
  });

  it('muestra errores de API dentro del editor y permite reintentar', () => {
    api.save.and.returnValue(throwError(() => ({ error: { message: 'Error de prueba' } })));
    const component = editor({ mode: 'edit', row }).componentInstance;
    component.save();
    expect(component.error()).toBe('Error de prueba');
    expect(component.saving()).toBeFalse();
  });

  it('resuelve catálogos tardíos del asistente y conserva el cálculo actual', () => {
    const fixture = TestBed.createComponent(ProveedorViajeEditorModalComponent);
    fixture.componentRef.setInput('request', {
      mode: 'create',
      prefill: {
        cliente_id: '1',
        proveedor_id: '2',
        tarifa_ruta_id: '3',
        precio_viaje: '1000',
        viaticos: '20'
      }
    });
    fixture.detectChanges();
    fixture.componentRef.setInput('clientes', [row.cliente]);
    fixture.componentRef.setInput('proveedores', [row.proveedor]);
    fixture.componentRef.setInput('tarifasRuta', [row.tarifa_ruta]);
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.valor_a_facturar.value).toBe(970);
    expect(fixture.componentInstance.form.controls.precio_pagar_proveedor.value).toBe(873);
    expect(fixture.componentInstance.clienteInput()).toContain(row.cliente.nombre);
  });
});
