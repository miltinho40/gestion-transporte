import assert from 'node:assert/strict';
import test from 'node:test';
import {
  abonoFacturaSchema,
  cerrarFacturaSchema,
  configuracionFacturaSchema,
  crearFacturaSchema,
  listadoFacturasSchema,
  numeroBorradorSchema,
  versionFacturaSchema
} from './facturacion.schema.js';

test('crear y cerrar conservan confirmación de importes y versión obligatoria', () => {
  const amounts = { neto_confirmado: 940, total_facturar_confirmado: 1000 };
  const invoice = {
    destinatario_id: '1',
    numero: '001-001-123',
    fecha: '2026-11-24',
    comision_empresa: 2,
    ir_empresa: true,
    detalles: [{ tipo: 'propio', id: '2', comision_cliente: 3, ir_cliente: false }]
  };
  assert.equal(crearFacturaSchema.safeParse(invoice).success, false);
  assert.equal(crearFacturaSchema.safeParse({ ...invoice, ...amounts }).success, true);
  assert.equal(cerrarFacturaSchema.safeParse(amounts).success, false);
  assert.equal(cerrarFacturaSchema.safeParse({ ...amounts, version: 0 }).success, true);
  assert.equal(cerrarFacturaSchema.safeParse({ ...amounts, version: -1 }).success, false);
  assert.equal(
    cerrarFacturaSchema.safeParse({ ...amounts, neto_confirmado: -1, version: 1 }).success,
    false
  );
  assert.equal(versionFacturaSchema.safeParse({ version: '1' }).success, false);
});

test('el borrador permite número vacío o nulo, sin cambiar los límites', () => {
  assert.equal(numeroBorradorSchema.parse('  001  '), '001');
  for (const value of ['', null, undefined])
    assert.equal(numeroBorradorSchema.safeParse(value).success, true);
  assert.equal(numeroBorradorSchema.safeParse('1'.repeat(81)).success, false);
});

test('abonos validan fecha, soporte e importe positivo con dos decimales', () => {
  const payment = { fecha: '2026-11-24', monto: 100.25, soporte: '  TRANSFERENCIA  ' };
  assert.equal(abonoFacturaSchema.parse(payment).soporte, 'TRANSFERENCIA');
  for (const monto of [0, -1, 1.001, 10000000000]) {
    assert.equal(abonoFacturaSchema.safeParse({ ...payment, monto }).success, false);
  }
  assert.equal(abonoFacturaSchema.safeParse({ ...payment, fecha: '2026-02-30' }).success, false);
  assert.equal(abonoFacturaSchema.safeParse({ ...payment, soporte: ' ' }).success, false);
});

test('listado y configuración conservan sus valores predeterminados y permisos de datos', () => {
  assert.deepEqual(listadoFacturasSchema.parse({}), { page: 1, search: '' });
  assert.equal(listadoFacturasSchema.parse({ page: '2' }).page, 2);
  assert.equal(listadoFacturasSchema.safeParse({ page: 0 }).success, false);
  const config = {
    cliente_id: '1',
    destinatario_id: null,
    porcentaje_comision: 3,
    ir_cliente: false,
    ir_empresa: true
  };
  assert.equal(configuracionFacturaSchema.safeParse(config).success, true);
  assert.equal(
    configuracionFacturaSchema.safeParse({ ...config, porcentaje_comision: 101 }).success,
    false
  );
  assert.equal(
    configuracionFacturaSchema.safeParse({ ...config, modalidad_comision: 'OTRA' }).success,
    false
  );
});
