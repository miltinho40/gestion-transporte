import assert from 'node:assert/strict';
import test from 'node:test';
import { semanaFacturacion, viajesFacturacionFiltersSchema } from './facturacion.filters.js';

test('sin filtros de facturación se consideran todos los clientes, vehículos y semanas', () => {
  const filters = viajesFacturacionFiltersSchema.parse({});
  assert.deepEqual(filters.cliente_ids, []);
  assert.deepEqual(filters.vehiculo_ids, []);
  assert.deepEqual(filters.semanas, []);
  assert.equal(filters.page, 1);
  assert.equal(filters.limit,25);
});

test('acepta filtros múltiples y valores vacíos', () => {
  const filters = viajesFacturacionFiltersSchema.parse({ cliente_ids: '7, 35', vehiculo_ids: ['1', '2'], semanas: '22,23,53' });
  assert.deepEqual(filters.cliente_ids, ['7', '35']);
  assert.deepEqual(filters.vehiculo_ids, ['1', '2']);
  assert.deepEqual(filters.semanas, [22, 23, 53]);
  assert.deepEqual(viajesFacturacionFiltersSchema.parse({ cliente_ids: '', vehiculo_ids: '', semanas: '' }).semanas, []);
});

test('rechaza identificadores y semanas inválidos', () => {
  for (const query of [{ cliente_ids: '0' }, { vehiculo_ids: '-1' }, { semanas: '54' }, { semanas: '0' }, { semanas: '22.5' }]) {
    assert.equal(viajesFacturacionFiltersSchema.safeParse(query).success, false);
  }
});

test('paginación de facturación permite únicamente 25, 50 o 100',()=>{
  for(const limit of [25,50,100])assert.equal(viajesFacturacionFiltersSchema.parse({limit:String(limit)}).limit,limit);
  for(const limit of [0,10,30,101])assert.equal(viajesFacturacionFiltersSchema.safeParse({limit}).success,false);
});

test('semanas ISO de facturación, incluidos los límites de año', () => {
  for (const [date, week] of [['2026-06-15', 25], ['2026-06-21', 25], ['2026-06-22', 26], ['2027-01-01', 53], ['2027-01-04', 1]] as const) {
    assert.equal(semanaFacturacion(new Date(`${date}T00:00:00Z`)), week);
  }
});
