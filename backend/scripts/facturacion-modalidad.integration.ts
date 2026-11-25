import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/config/prisma.js';
import { signToken } from '../src/config/jwt.js';

if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw Error('Solo local');
const marker = `TEST-MODO-${randomUUID()}`;
let clientId: bigint | undefined, sessionId: string | undefined;
const invoices: bigint[] = [], trips: bigint[] = [], providers: bigint[] = [];
try {
  const source = await prisma.viaje.findFirstOrThrow({ where: { estado: { not: 'CANCELADO' } } });
  const user = await prisma.usuario.findFirstOrThrow({ where: { es_super_admin: true, activo: true, requiere_password: false } });
  const session = await prisma.sesionUsuario.create({ data: { usuario_id: user.id, propietario_id: source.propietario_id, refresh_token_hash: randomUUID(), expira_en: new Date(Date.now() + 3600000) } });
  sessionId = session.id;
  const token = signToken({ usuario_id: String(user.id), sesion_id: session.id, propietario_id: String(source.propietario_id), es_super_admin: true });
  const request = async (path: string, method = 'GET', body?: unknown) => {
    const r = await fetch(`http://localhost:3000/api${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json() as any };
  };
  const company = await request('/clientes', 'POST', { nombre: marker, ruc_cedula: 'TEST' + randomUUID().replaceAll('-', '').slice(0, 14), porcentaje_comision: 2, modalidad_comision: 'AL_PAGAR', ir_facturacion: true });
  assert.equal(company.status, 201, JSON.stringify(company)); clientId = BigInt(company.data.id);
  const clientName = company.data.nombre;
  assert.equal(company.data.modalidad_comision, 'AL_PAGAR');
  assert.equal(Number(company.data.porcentaje_comision), 2);
  assert.equal(Object.hasOwn(company.data,'comision_facturacion'),false);
  assert.equal(company.data.ir_facturacion, true);
  const own = await prisma.viaje.create({ data: { ...source, id: undefined, cliente_id: clientId, cobrado: false, fecha_cobro: null, created_at: undefined, updated_at: undefined, precio_flete: 1000 } }); trips.push(own.id);
  const base = { destinatario_id: String(clientId), numero: marker, fecha: '2026-11-24', comision_empresa: 2, ir_empresa: true, modalidad_comision: 'AL_PAGAR', detalles: [{ tipo: 'propio', id: String(own.id), comision_cliente: 8, ir_cliente: true }] };
  const preview = await request('/facturacion/previsualizar', 'POST', base);
  assert.equal(preview.status, 200);
  assert.equal(Number(preview.data.total_facturar), 1000);
  assert.equal(Number(preview.data.neto), 970);
  const saved = await request('/facturacion', 'POST', { ...base, neto_confirmado: 970, total_facturar_confirmado: 1000 });
  assert.equal(saved.status, 201, JSON.stringify(saved)); invoices.push(BigInt(saved.data.id));
  assert.equal(saved.data.modalidad_comision, 'AL_PAGAR');

  const changed = await request(`/clientes/${clientId}`, 'PUT', { porcentaje_comision: 8, modalidad_comision: 'EN_FACTURA', ir_facturacion: true });
  assert.equal(changed.status, 200);
  const configs = await request('/facturacion/configuracion');
  const config = configs.data.find((c: any) => c.id === String(clientId)).configuracion_facturacion;
  assert.equal(config.modalidad_comision, 'EN_FACTURA');
  assert.equal(Number(config.comision_empresa), 8);
  assert.equal(Number(config.comision_cliente), 8);
  const existing = await request(`/facturacion/${saved.data.id}`);
  assert.equal(existing.data.modalidad_comision, 'AL_PAGAR');
  assert.equal(Number(existing.data.total_facturar), 1000);
  assert.equal(Number(existing.data.neto), 970);

  const provider = await prisma.viajeProveedor.findFirst({ where: { propietario_id: source.propietario_id } });
  let nextId: bigint, nextType: string;
  if (provider) {
    const v = await prisma.viajeProveedor.create({ data: { ...provider, id: undefined, cliente_id: clientId, cobrado: false, fecha_cobro: null, created_at: undefined, updated_at: undefined, precio_viaje: 1000, precio_pagar_proveedor: 600, viaticos: 20 } });
    providers.push(v.id); nextId = v.id; nextType = 'proveedor';
  } else {
    const v = await prisma.viaje.create({ data: { ...source, id: undefined, cliente_id: clientId, cobrado: false, fecha_cobro: null, created_at: undefined, updated_at: undefined, precio_flete: 1000 } });
    trips.push(v.id); nextId = v.id; nextType = 'propio';
  }
  const discounted = { ...base, numero: marker + '-EN', modalidad_comision: 'EN_FACTURA', comision_empresa: 8, detalles: [{ tipo: nextType, id: String(nextId), comision_cliente: 8, ir_cliente: true }] };
  const secondPreview = await request('/facturacion/previsualizar', 'POST', discounted);
  assert.equal(secondPreview.status, 200);
  assert.equal(Number(secondPreview.data.total_facturar), 920);
  assert.equal(Number(secondPreview.data.total_comision), 80);
  assert.equal(Number(secondPreview.data.total_ir), 9.2);
  assert.equal(Number(secondPreview.data.neto), 910.8);
  const draft = await request('/facturacion/borradores', 'POST', discounted);
  assert.equal(draft.status, 201); invoices.push(BigInt(draft.data.id));
  assert.equal(draft.data.modalidad_comision, 'EN_FACTURA');
  assert.equal((await request(`/clientes/${clientId}`, 'PUT', { porcentaje_comision: 2, modalidad_comision: 'AL_PAGAR', ir_facturacion: false })).status, 200);
  const closed = await request(`/facturacion/${draft.data.id}/cerrar`, 'POST', { version: draft.data.version, neto_confirmado: 910.8, total_facturar_confirmado: 920 });
  assert.equal(closed.status, 200, JSON.stringify(closed));
  assert.equal(closed.data.modalidad_comision, 'EN_FACTURA');
  assert.equal(Number(closed.data.comision_empresa), 8);
  assert.equal(closed.data.ir_empresa, true);
  assert.equal(Number(closed.data.neto), 910.8);
  const sharedDefault = await request('/facturacion/configuracion','PUT',{cliente_id:String(clientId),destinatario_id:null,porcentaje_comision:5,ir_cliente:false,ir_empresa:false,modalidad_comision:'AL_PAGAR'});
  assert.equal(sharedDefault.status,200,JSON.stringify(sharedDefault));
  assert.equal(Number(sharedDefault.data.comision_cliente),5);
  assert.equal(Number(sharedDefault.data.comision_empresa),5);
  assert.equal(Number((await request(`/clientes/${clientId}`)).data.porcentaje_comision),5);
  assert.equal((await request(`/clientes/${clientId}`,'PUT',{porcentaje_comision:2})).status,200);
  const restoredDefaults=(await request('/facturacion/configuracion')).data.find((c:any)=>c.id===String(clientId));
  assert.equal(Number(restoredDefaults.configuracion_facturacion.comision_cliente),2);
  assert.equal(Number(restoredDefaults.configuracion_facturacion.comision_empresa),2);
  assert.equal(Number((await request(`/facturacion/${saved.data.id}`)).data.comision_empresa),2);
  assert.equal(Number((await request(`/facturacion/${draft.data.id}`)).data.comision_empresa),8);
  if (provider) {
    const v = await prisma.viajeProveedor.findUniqueOrThrow({ where: { id: nextId } });
    assert.equal(Number(v.utilidad), 290.8);
    assert.equal(v.pagado_proveedor, provider.pagado_proveedor);
  }
  const foreign = await prisma.cliente.findFirst({ where: { propietario_id: { not: source.propietario_id } } });
  if (foreign) assert.equal((await request(`/clientes/${foreign.id}`, 'PUT', { modalidad_comision: 'EN_FACTURA' })).status, 404);

  const available = await prisma.viaje.create({ data: { ...source, id: undefined, cliente_id: clientId, cobrado: false, fecha_cobro: null, created_at: undefined, updated_at: undefined, precio_flete: 1000, numeros_guia_remision: [marker + '-OPEN'] } }); trips.push(available.id);
  const { chromium } = await import('../../frontend/node_modules/playwright/index.mjs');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/auth/refresh', route => route.fulfill({ json: { token, usuario: { id: String(user.id), nombre: 'Prueba local', es_super_admin: true }, contexto: { propietario_id: String(source.propietario_id), propietario_nombre: 'Prueba local', rol: 'admin', es_propietario: true, es_intermediario: true }, propietarios: [] } }));
    await page.goto('http://localhost:4200/app/clientes?new=1');
    await page.locator('#porcentaje_comision').waitFor();
    assert.equal(await page.locator('#comision_facturacion').count(),0);
    await page.locator('#modalidad_comision').selectOption('EN_FACTURA');
    assert.equal(await page.locator('#ir_facturacion').isChecked(), true);
    const billingRow=await page.evaluate(`(() => ['porcentaje_comision','modalidad_comision','ir_facturacion','activo'].map(id=>document.getElementById(id).getBoundingClientRect().y))()`);
    assert.ok(Math.max(...billingRow)-Math.min(...billingRow)<20,JSON.stringify(billingRow));
    await page.screenshot({ path: process.env.TEMP + '/transporte-cliente-comision.png', fullPage: true });
    await page.goto('http://localhost:4200/app/facturacion');
    await page.locator('#billing-search').fill(marker + '-OPEN');
    await page.getByRole('checkbox', { name: 'Seleccionar viaje de ' + clientName, exact: true }).check();
    await page.getByRole('button', { name: /^Facturar \(/ }).click();
    await page.locator('#billing-recipient').fill(marker);
    await page.locator('#billing-recipient-options').getByRole('option', { name: clientName, exact: true }).click();
    await page.waitForFunction(() => (document.getElementById('billing-commission') as HTMLInputElement)?.value === '2');
    assert.equal(await page.locator('#commission-at-payment').isChecked(), true);
    assert.equal(await page.locator('#billing-ir').isChecked(), false);
    const calculation = page.waitForResponse(r => r.url().endsWith('/facturacion/previsualizar'));
    await page.locator('label[for="commission-in-invoice"]').click();
    const amounts = await (await calculation).json();
    assert.equal(Number(amounts.total_facturar), 980);
    assert.equal(Number(amounts.neto), 980);
    await page.getByRole('button', { name: 'Guardar en preparación', exact: true }).waitFor();
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Guardar en preparación'))?.disabled);
    await page.screenshot({ path: process.env.TEMP + '/transporte-factura-modalidad.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: process.env.TEMP + '/transporte-factura-modalidad-movil.png', fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  console.log('OK: Clientes y Facturación comparten predeterminados; ejemplos 1000/970 y 920/910.80, snapshots de facturas y borradores, proveedores, permisos y formulario web/móvil.');
} finally {
  await prisma.abonoFacturaTransporte.deleteMany({ where: { factura_id: { in: invoices } } });
  await prisma.detalleFacturaTransporte.deleteMany({ where: { factura_id: { in: invoices } } });
  await prisma.facturaTransporte.deleteMany({ where: { id: { in: invoices } } });
  await prisma.viaje.deleteMany({ where: { id: { in: trips } } });
  await prisma.viajeProveedor.deleteMany({ where: { id: { in: providers } } });
  if (clientId) {
    await prisma.configuracionFacturacion.deleteMany({ where: { cliente_id: clientId } });
    await prisma.cliente.delete({ where: { id: clientId } });
  }
  if (sessionId) await prisma.sesionUsuario.delete({ where: { id: sessionId } });
  await prisma.auditoriaEvento.deleteMany({ where: { entidad: 'facturacion', entidad_id: { in: invoices.map(String) } } });
  await prisma.$disconnect();
}
