import type { Amounts, Invoice, Preview, Trip } from './facturacion.models';
import {
  invoiceGroups,
  key,
  preparationGroups,
  selectionState,
  shortGuides,
  week
} from './facturacion.view-helpers';

const trip = (overrides: Partial<Trip> = {}): Trip => ({
  id: '1',
  tipo: 'propio',
  cliente_id: '1',
  cliente: 'Cliente',
  fecha: '2026-11-24',
  placa: 'OAA1227',
  ruta: 'MACHALA - VINCES',
  destino: 'VINCES',
  proveedor_id: null,
  proveedor: null,
  guias: [],
  precio: 100,
  comision_cliente: 3,
  ir_cliente: false,
  destinatario_id: '2',
  ...overrides
});
const amount = (value: number): Amounts => ({
  precio: value,
  a_facturar: value,
  comision_empresa: 0,
  ir_empresa: 0,
  neto: value,
  monto_comision_cliente: 0,
  monto_ir_cliente: 0
});

describe('Facturación: agrupamiento y selección compartidos', () => {
  it('distingue viajes propios y de proveedor con el mismo id', () => {
    const own = trip(),
      external = trip({ tipo: 'proveedor', proveedor_id: '4', proveedor: 'Proveedor' });
    expect(key(own)).not.toBe(key(external));
    expect(selectionState([own, external], new Set([key(own)]))).toEqual({
      all: false,
      partial: true
    });
    expect(selectionState([], new Set())).toEqual({ all: false, partial: false });
    expect(selectionState([own], new Set([key(own), 'propio:99']))).toEqual({
      all: true,
      partial: false
    });
  });

  it('conserva el índice de los importes al ordenar y agrupar para preparar', () => {
    const rows = [
      trip({ id: '2', placa: 'OAA1588' }),
      trip({ id: '3' }),
      trip({ id: '1', fecha: '2026-11-25' })
    ];
    const original = [...rows];
    const preview: Preview = {
      detalles: [amount(10), amount(0.1), amount(0.2)],
      total_facturar: 10.3,
      total_comision: 0,
      total_ir: 0,
      neto: 10.3
    };
    const groups = preparationGroups(rows, preview);
    expect(groups.map((group) => group.label)).toEqual(['Placa OAA1227', 'Placa OAA1588']);
    expect(groups[0].rows.map((row) => row.index)).toEqual([2, 1]);
    expect(groups[0].total).toBe(0.3);
    expect(groups[1].total).toBe(10);
    expect(rows).toEqual(original);
    expect(preparationGroups(rows, null).every((group) => group.total === null)).toBeTrue();
  });

  it('agrupa el detalle de factura por placa/proveedor con los importes guardados', () => {
    const own = trip(),
      external = trip({
        tipo: 'proveedor',
        proveedor_id: '4',
        proveedor: 'Proveedor',
        placa: null
      });
    const invoice: Invoice = {
      id: '1',
      numero: '001',
      fecha: '2026-11-24',
      destinatario: {
        id: '2',
        nombre: 'TRASOSA',
        porcentaje_comision: 2,
        configuracion_facturacion: {
          destinatario_id: null,
          comision_cliente: 2,
          comision_empresa: 2,
          ir_cliente: false,
          ir_empresa: true,
          modalidad_comision: 'AL_PAGAR'
        }
      },
      saldo: 20,
      recibido: 0,
      comision_empresa: 2,
      ir_empresa: true,
      modalidad_comision: 'AL_PAGAR',
      estado: 'FACTURADA',
      version: 1,
      viajes: [own, external],
      abonos: [],
      detalles: [amount(8), amount(12)],
      total_facturar: 20,
      total_comision: 0,
      total_ir: 0,
      neto: 20
    };
    const groups = invoiceGroups(invoice);
    expect(groups.map((group) => group.total)).toEqual([8, 12]);
    expect(groups[1].label).toBe('Proveedor: Proveedor');
    expect(groups[0].rows[0].amounts).toBe(invoice.detalles[0]);
    expect(invoiceGroups(null)).toEqual([]);
  });

  it('respeta los límites de guías y la semana ISO de salida', () => {
    expect(shortGuides(trip({ guias: ['12345678901'] }))).toBe('1234567890...');
    expect(shortGuides(trip({ guias: ['1234567890123456'] }), 15)).toBe('123456789012345...');
    expect(shortGuides(trip())).toBe('-');
    expect(week('2026-11-24')).toBe(48);
    expect(week('2027-01-01')).toBe(53);
  });
});
