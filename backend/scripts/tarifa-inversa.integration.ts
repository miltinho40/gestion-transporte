import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/config/prisma.js';
import { signToken } from '../src/config/jwt.js';
import { destinoTarifaWhere } from '../src/modules/tarifas-ruta/ruta-tarifa.js';

if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw Error('Solo local');
const marker = `TEST-INV-${randomUUID()}`;
const tarifas: bigint[] = [];
const trips: bigint[] = [];
let sessionId: string | undefined;
try {
  const source = await prisma.viaje.findFirstOrThrow({
    where: { estado: { not: 'CANCELADO' }, tarifa_ruta: { activa: true, ruta: { activa: true }, tipo_carga: { activo: true } } },
    include: { tarifa_ruta: { include: { ruta: true } } }
  });
  const user = await prisma.usuario.findFirstOrThrow({ where: { es_super_admin: true, activo: true, requiere_password: false } });
  const session = await prisma.sesionUsuario.create({ data: {
    usuario_id: user.id, propietario_id: source.propietario_id, refresh_token_hash: randomUUID(), expira_en: new Date(Date.now() + 3600000)
  } });
  sessionId = session.id;
  const token = signToken({ usuario_id: String(user.id), sesion_id: session.id, propietario_id: String(source.propietario_id), es_super_admin: true });
  const request = async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(`http://localhost:3000/api${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, data: await response.json() as any };
  };
  const rutaCount = await prisma.ruta.count();
  const payload = {
    ruta_id: String(source.tarifa_ruta.ruta_id), tipo_carga_id: String(source.tarifa_ruta.tipo_carga_id),
    capacidad: marker, toneladas: null, precio: 300, vigente_desde: '2025-01-01', vigente_hasta: '2028-12-31'
  };
  const normal = await request('/tarifas-ruta', 'POST', payload);
  assert.equal(normal.status, 201, JSON.stringify(normal));
  tarifas.push(BigInt(normal.data.id));
  assert.equal(normal.data.ruta_inversa, false);
  const inverse = await request('/tarifas-ruta', 'POST', { ...payload, ruta_inversa: true, precio: 250 });
  assert.equal(inverse.status, 201, JSON.stringify(inverse));
  tarifas.push(BigInt(inverse.data.id));
  assert.equal(inverse.data.ruta.origen, source.tarifa_ruta.ruta.destino);
  assert.equal(inverse.data.ruta.destino, source.tarifa_ruta.ruta.origen);
  assert.equal(inverse.data.ruta_id, normal.data.ruta_id);
  assert.equal(Number(inverse.data.precio), 250);
  const duplicate = await request('/tarifas-ruta', 'POST', { ...payload, ruta_inversa: true });
  if (duplicate.status === 201) tarifas.push(BigInt(duplicate.data.id));
  assert.equal(duplicate.status, 409);
  const listed = await request(`/tarifas-ruta?search=${marker}&page=1&limit=50`);
  assert.equal(listed.data.meta.total, 2);
  assert.equal(listed.data.data.find((t: any) => t.ruta_inversa).ruta.origen, inverse.data.ruta.origen);
  const trip = await prisma.viaje.create({ data: {
    ...source, tarifa_ruta: undefined, id: undefined, created_at: undefined, updated_at: undefined,
    tarifa_ruta_id: tarifas[1], numeros_guia_remision: [marker], retorno: false
  } });
  trips.push(trip.id);
  const detail = await request(`/viajes/${trip.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.tarifa_ruta.ruta.origen, inverse.data.ruta.origen);
  assert.equal(detail.data.tarifa_ruta.ruta.destino, inverse.data.ruta.destino);
  assert.equal(detail.data.retorno, false);
  assert.equal(await prisma.viaje.count({ where: { id: trip.id, tarifa_ruta: destinoTarifaWhere(inverse.data.ruta.destino) } }), 1);
  const report = await request(`/reportes/viajes?anio=${source.fecha_salida.getUTCFullYear()}&search=${marker}`);
  assert.equal(report.status, 200);
  const reportText = JSON.stringify(report.data);
  assert.ok(reportText.includes(inverse.data.ruta.destino));
  const updated = await request(`/tarifas-ruta/${inverse.data.id}`, 'PUT', { ruta_inversa: false, capacidad: marker + '-R', precio: 275 });
  assert.equal(updated.status, 200, JSON.stringify(updated));
  assert.equal(Number(updated.data.precio), 275);
  const updatedTrip = await request(`/viajes/${trip.id}`);
  assert.equal(updatedTrip.data.tarifa_ruta.ruta.origen, source.tarifa_ruta.ruta.origen);
  assert.equal(updatedTrip.data.tarifa_ruta.ruta.destino, source.tarifa_ruta.ruta.destino);
  assert.equal(Number(updatedTrip.data.precio_flete), Number(source.precio_flete));
  assert.equal((await request(`/tarifas-ruta/${inverse.data.id}`, 'PUT', { ruta_inversa: true })).status, 200);
  assert.equal(await prisma.ruta.count(), rutaCount);
  const ruta = await prisma.ruta.findUniqueOrThrow({ where: { id: source.tarifa_ruta.ruta_id } });
  assert.equal(ruta.origen, source.tarifa_ruta.ruta.origen);
  assert.equal(ruta.destino, source.tarifa_ruta.ruta.destino);

  const { chromium } = await import('../../frontend/node_modules/playwright/index.mjs');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('**/auth/refresh', route => route.fulfill({ json: {
      token, usuario: { id: String(user.id), nombre: 'Prueba local', es_super_admin: true },
      contexto: { propietario_id: String(source.propietario_id), propietario_nombre: 'Prueba local', rol: 'admin', es_propietario: true, es_intermediario: true }, propietarios: []
    } }));
    await page.goto('http://localhost:4200/app/tarifas-ruta?new=1');
    await page.locator('#ruta_inversa').waitFor();
    await page.locator('#ruta_inversa').check();
    assert.equal(await page.locator('#ruta_inversa').isChecked(), true);
    const formLayout = await page.evaluate(`(() => {
      const rect = id => document.getElementById(id).getBoundingClientRect();
      return {
        first: ['ruta_id', 'tipo_carga_id', 'ruta_inversa', 'activa'].map(id => rect(id).y),
        second: ['capacidad', 'toneladas', 'precio', 'vigente_desde', 'vigente_hasta'].map(id => rect(id).y)
      };
    })()`);
    assert.ok(Math.max(...formLayout.first) - Math.min(...formLayout.first) < 20, JSON.stringify(formLayout));
    assert.ok(Math.max(...formLayout.second) - Math.min(...formLayout.second) < 2, JSON.stringify(formLayout));
    assert.ok(Math.min(...formLayout.second) > Math.max(...formLayout.first));
    await page.screenshot({ path: process.env.TEMP + '/transporte-precio-inverso-web.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://localhost:4200/movil/precios/${inverse.data.id}/editar`);
    const toggle = page.locator('input[formcontrolname="ruta_inversa"]');
    await toggle.waitFor();
    await page.waitForFunction(() => (document.querySelector('input[formcontrolname="ruta_inversa"]') as HTMLInputElement)?.checked);
    await page.screenshot({ path: process.env.TEMP + '/transporte-precio-inverso-movil.png', fullPage: true });
  } finally { await browser.close(); }
  console.log('OK: misma ruta, tarifas ida/vuelta, duplicados, viaje sin retorno, búsqueda, edición con viajes existentes, formulario web y móvil.');
} finally {
  await prisma.viaje.deleteMany({ where: { id: { in: trips } } });
  await prisma.tarifaRuta.deleteMany({ where: { id: { in: tarifas } } });
  await prisma.auditoriaEvento.deleteMany({ where: { entidad: 'tarifa_ruta', entidad_id: { in: tarifas.map(String) } } });
  if (sessionId) await prisma.sesionUsuario.delete({ where: { id: sessionId } });
  await prisma.$disconnect();
}
