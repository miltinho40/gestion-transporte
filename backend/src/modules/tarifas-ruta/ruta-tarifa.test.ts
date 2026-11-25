import assert from 'node:assert/strict';
import test from 'node:test';
import { destinoTarifaWhere, formatTarifaRuta, rutaDeTarifa } from './ruta-tarifa.js';
import { tarifaRutaCreateSchema, tarifaRutaUpdateSchema } from './tarifas-ruta.schema.js';
import { formatViaje } from '../viajes/viajes.mapper.js';
import { formatViajeProveedor } from '../viajes-proveedor/viajes-proveedor.mapper.js';
import { EstadoViaje } from '@prisma/client';

const ruta = { id: 7n, origen: 'MACHALA', destino: 'VINCES', distancia_km: 265 };

test('la ruta conserva su sentido cuando no está invertida', () => {
  assert.deepEqual(rutaDeTarifa({ ruta }), ruta);
  assert.deepEqual(rutaDeTarifa({ ruta, ruta_inversa: false }), ruta);
});

test('invierte solo los extremos y no modifica el destino compartido', () => {
  const tarifa = { id: 9n, ruta_id: 7n, ruta, ruta_inversa: true, precio: 300 };
  const result = formatTarifaRuta(tarifa);
  assert.equal(result.ruta.origen, 'VINCES');
  assert.equal(result.ruta.destino, 'MACHALA');
  assert.equal(result.ruta.id, ruta.id);
  assert.equal(result.ruta.distancia_km, 265);
  assert.equal(result.precio, 300);
  assert.equal(tarifa.ruta.origen, 'MACHALA');
  assert.equal(tarifa.ruta.destino, 'VINCES');
});

test('viajes propios y de proveedores muestran el sentido de la tarifa sin activar retorno', () => {
  const viaje = { estado: EstadoViaje.PROGRAMADO, retorno: false, tarifa_ruta: { ruta, ruta_inversa: true } };
  assert.equal(formatViaje(viaje).tarifa_ruta?.ruta.destino, 'MACHALA');
  assert.equal(formatViaje(viaje).retorno, false);
  assert.equal(formatViajeProveedor(viaje).tarifa_ruta?.ruta.origen, 'VINCES');
});

test('la búsqueda por destino contempla ambos sentidos', () => {
  assert.deepEqual(destinoTarifaWhere('Machala').OR, [
    { ruta_inversa: false, ruta: { destino: { contains: 'Machala', mode: 'insensitive' } } },
    { ruta_inversa: true, ruta: { origen: { contains: 'Machala', mode: 'insensitive' } } }
  ]);
});

test('el sentido es opcional en tarifas anteriores y valida booleanos explícitos', () => {
  const payload = { ruta_id: '1', tipo_carga_id: '1', precio: 300 };
  assert.equal(tarifaRutaCreateSchema.parse(payload).ruta_inversa, undefined);
  assert.equal(tarifaRutaCreateSchema.parse({ ...payload, ruta_inversa: true }).ruta_inversa, true);
  assert.equal(tarifaRutaUpdateSchema.parse({ ruta_inversa: false }).ruta_inversa, false);
  assert.equal(tarifaRutaCreateSchema.safeParse({ ...payload, ruta_inversa: 'true' }).success, false);
});
