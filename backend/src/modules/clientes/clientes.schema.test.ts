import assert from 'node:assert/strict';
import test from 'node:test';
import { clienteCreateSchema, clienteUpdateSchema } from './clientes.schema.js';

test('cliente tiene un solo porcentaje y no acepta un segundo valor como fuente de comisión', () => {
  const value = clienteCreateSchema.parse({ nombre: 'TRASOSA', ruc_cedula: '123', porcentaje_comision: 2, comision_facturacion: 8 });
  assert.equal(value.porcentaje_comision, 2);
  assert.equal(Object.hasOwn(value, 'comision_facturacion'), false);
});

test('comisión, aplicación e IR pueden actualizarse de forma independiente', () => {
  assert.deepEqual(clienteUpdateSchema.parse({ porcentaje_comision: 8 }), { porcentaje_comision: 8 });
  assert.deepEqual(clienteUpdateSchema.parse({ modalidad_comision: 'EN_FACTURA', ir_facturacion: false }), { modalidad_comision: 'EN_FACTURA', ir_facturacion: false });
});

test('valida límites y modalidad de la comisión única', () => {
  for (const value of [{ porcentaje_comision: -1 }, { porcentaje_comision: 101 }, { modalidad_comision: 'OTRA' }]) {
    assert.equal(clienteUpdateSchema.safeParse(value).success, false);
  }
});
