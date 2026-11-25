import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { signToken } from '../src/config/jwt.js';

// Never run against production. All writes belong to a disposable owner.
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL!).hostname), 'Solo BD local');
const prisma = new PrismaClient({ log: ['error'] });
const marker = `TEST-CIERRE-${randomUUID()}`;
let ownerId: bigint | undefined;
let sessionId: string | undefined;
const invoices: bigint[] = [];
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const fingerprint = async () => {
  const rows = await Promise.all([
    prisma.propietario.findMany({ orderBy: { id: 'asc' } }),
    prisma.cliente.findMany({ orderBy: { id: 'asc' } }),
    prisma.vehiculo.findMany({ orderBy: { id: 'asc' } }),
    prisma.conductor.findMany({ orderBy: { id: 'asc' } }),
    prisma.viaje.findMany({ orderBy: { id: 'asc' } }),
    prisma.proveedor.findMany({ orderBy: { id: 'asc' } }),
    prisma.viajeProveedor.findMany({ orderBy: { id: 'asc' } }),
    prisma.mantenimiento.findMany({ orderBy: { id: 'asc' } }),
    prisma.gastoSemanalVehiculo.findMany({ orderBy: { id: 'asc' } }),
    prisma.cierreSemanal.findMany({ orderBy: { id: 'asc' } }),
    prisma.facturaTransporte.findMany({ orderBy: { id: 'asc' } }),
    prisma.detalleFacturaTransporte.findMany({ orderBy: { id: 'asc' } }),
    prisma.abonoFacturaTransporte.findMany({ orderBy: { id: 'asc' } })
  ]);
  return createHash('sha256').update(JSON.stringify(rows, (_, value) => typeof value === 'bigint' ? String(value) : value)).digest('hex');
};
const before = await fingerprint();
try {
  const owner = await prisma.propietario.create({ data: { nombre: marker, ruc_cedula: randomUUID().slice(0, 20), limite_vehiculos: 10 } });
  ownerId = owner.id;
  const category = await prisma.categoriaPeaje.create({ data: { propietario_id: owner.id, nombre: marker } });
  const vehicle = await prisma.vehiculo.create({ data: { propietario_id: owner.id, categoria_peaje_id: category.id, placa: 'TEST1227', marca: 'PRUEBA', capacidad: 7000, toneladas: 10, rendimiento_km_galon: 10 } });
  const driver = await prisma.conductor.create({ data: { propietario_id: owner.id, nombre: 'CONDUCTOR PRUEBA', cedula: 'TEST', numero_licencia: 'TEST', fecha_caducidad_licencia: date('2099-01-01'), telefono: '000', sueldo_semanal: 150 } });
  const client = await prisma.cliente.create({ data: { propietario_id: owner.id, nombre: 'CLIENTE PRUEBA', ruc_cedula: 'TEST-CLIENTE', porcentaje_comision: 3 } });
  const company = await prisma.cliente.create({ data: { propietario_id: owner.id, nombre: 'EMPRESA PRUEBA', ruc_cedula: 'TEST-EMPRESA', porcentaje_comision: 2 } });
  const route = await prisma.ruta.create({ data: { propietario_id: owner.id, origen: 'MACHALA', destino: 'VINCES' } });
  const cargo = await prisma.tipoCarga.create({ data: { propietario_id: owner.id, nombre: 'PRUEBA' } });
  const tariff = await prisma.tarifaRuta.create({ data: { propietario_id: owner.id, ruta_id: route.id, tipo_carga_id: cargo.id, precio: 1000, vigente_desde: date('2025-01-01') } });
  const provider = await prisma.proveedor.create({ data: { propietario_id: owner.id, nombre: 'PROVEEDOR PRUEBA', ruc_cedula: 'TEST-PROVEEDOR', porcentaje_utilidad: 10 } });
  const maintenanceType = await prisma.tipoMantenimiento.create({ data: { propietario_id: owner.id, nombre: 'ACEITE PRUEBA' } });
  await prisma.configuracionOperativa.createMany({ data: [
    { clave: 'bonificacion_flete_monto_minimo', valor: '1200' },
    { clave: 'bonificacion_flete_monto_tramo', valor: '100' },
    { clave: 'bonificacion_flete_valor_tramo', valor: '5' },
    { clave: 'bonificacion_flete_monto_maximo', valor: '0' }
  ].map(config => ({ ...config, propietario_id: owner.id })) });
  const own = await prisma.viaje.create({ data: { propietario_id: owner.id, cliente_id: client.id, vehiculo_id: vehicle.id, conductor_id: driver.id, tarifa_ruta_id: tariff.id, fecha_salida: date('2026-06-19'), fecha_llegada: date('2026-06-20'), precio_flete: 1000, precio_real_flete: 1000, viaticos: 100, costo_real_gastos: 100, numeros_guia_remision: [marker] } });
  const external = await prisma.viajeProveedor.create({ data: { propietario_id: owner.id, cliente_id: client.id, proveedor_id: provider.id, tarifa_ruta_id: tariff.id, fecha_salida: date('2026-06-19'), fecha_llegada: date('2026-06-20'), precio_viaje: 500, valor_a_facturar: 500, precio_pagar_proveedor: 400, viaticos: 20, numeros_guia_remision: [marker] } });
  const user = await prisma.usuario.findFirstOrThrow({ where: { es_super_admin: true, activo: true, requiere_password: false } });
  const session = await prisma.sesionUsuario.create({ data: { usuario_id: user.id, propietario_id: owner.id, refresh_token_hash: randomUUID(), expira_en: new Date(Date.now() + 3600000) } });
  sessionId = session.id;
  const token = signToken({ usuario_id: String(user.id), sesion_id: session.id, propietario_id: String(owner.id), es_super_admin: true });
  const request = async (path: string, body?: unknown, method?: string) => {
    const response = await fetch(`http://localhost:3000/api${path}`, { method: method ?? (body ? 'POST' : 'GET'), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() as any };
  };
  const expectStatus = (result: { status: number; data: unknown }, expected = 200) => assert.equal(result.status, expected, JSON.stringify(result.data));
  const filters = { anio: 2026, numero_semana: 25, vehiculo_id: String(vehicle.id) };
  const getClosure = async () => {
    const result = await request('/cierres-semanales?' + new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)])));
    expectStatus(result);
    return result.data;
  };
  const generate = () => request('/cierres-semanales/generar-gastos', filters);
  let closure = await getClosure();
  assert.equal(Number(closure.resumen.totales.utilidad), 900);
  expectStatus(await generate(), 201);
  closure = await getClosure();
  assert.equal(Number(closure.resumen.totales.resultado_operativo), 750);
  assert.equal(closure.revision_cierre.requiere_revision, false);
  const generatedCount = await prisma.gastoSemanalVehiculo.count({ where: { propietario_id: owner.id } });
  expectStatus(await generate(), 409);
  console.log('OK: cierre inicial, sueldo 150, ganancia 750 y bloqueo de generación duplicada.');

  const details = [
    { tipo: 'propio', id: String(own.id), comision_cliente: 3, ir_cliente: false },
    { tipo: 'proveedor', id: String(external.id), comision_cliente: 3, ir_cliente: false }
  ];
  const body = { destinatario_id: String(company.id), numero: '', fecha: '2026-06-22', comision_empresa: 2, ir_empresa: true, modalidad_comision: 'AL_PAGAR', detalles: details };
  for (const example of [
    { commission: 2, mode: 'AL_PAGAR', customerIR: false, fact: 1000, net: 970 },
    { commission: 2, mode: 'AL_PAGAR', customerIR: true, fact: 990, net: 960.3 },
    { commission: 8, mode: 'EN_FACTURA', customerIR: false, fact: 920, net: 910.8 }
  ]) {
    const result = await request('/facturacion/previsualizar', { ...body, comision_empresa: example.commission, modalidad_comision: example.mode, detalles: [{ ...details[0], comision_cliente: 0, ir_cliente: example.customerIR }] });
    expectStatus(result);
    assert.equal(Number(result.data.total_facturar), example.fact);
    assert.equal(Number(result.data.neto), example.net);
  }
  const foreign = await prisma.viaje.findFirst({ where: { propietario_id: { not: owner.id } } });
  if (foreign) {
    const denied = await request('/facturacion/previsualizar', { ...body, detalles: [{ ...details[0], id: String(foreign.id) }] });
    expectStatus(denied, 409);
  }
  const draft = await request('/facturacion/borradores', { ...body, detalles: [details[0]] });
  expectStatus(draft, 201); invoices.push(BigInt(draft.data.id));
  expectStatus(await request(`/facturacion/${draft.data.id}/abonos`, { fecha: '2026-06-22', monto: 1, soporte: marker }), 409);
  let appended = await request(`/facturacion/${draft.data.id}/borrador`, { ...body, numero: marker, version: draft.data.version }, 'PUT');
  expectStatus(appended);
  assert.equal(appended.data.detalles.length, 2);
  assert.equal(Number(appended.data.total_facturar), 1500);
  assert.equal(Number(appended.data.neto), 1410);
  expectStatus(await request(`/facturacion/${draft.data.id}/borrador`, { ...body, version: draft.data.version }, 'PUT'), 409);
  const removed = await request(`/facturacion/${draft.data.id}/borrador`, { ...body, numero: marker, version: appended.data.version, detalles: [details[0]] }, 'PUT');
  expectStatus(removed);
  const available = await request('/facturacion/viajes?search=' + encodeURIComponent(marker));
  expectStatus(available);
  assert.ok(available.data.items.some((item: any) => item.tipo === 'proveedor' && item.id === String(external.id)));
  appended = await request(`/facturacion/${draft.data.id}/borrador`, { ...body, numero: marker, version: removed.data.version }, 'PUT');
  expectStatus(appended);
  assert.equal((await getClosure()).revision_cierre.requiere_revision, false);
  const closed = await request(`/facturacion/${draft.data.id}/cerrar`, { numero: marker, version: appended.data.version, neto_confirmado: 1410, total_facturar_confirmado: 1500 });
  expectStatus(closed);
  closure = await getClosure();
  assert.equal(Number(closure.resumen.totales.utilidad), 840);
  assert.equal(Number(closure.resumen.totales.resultado_operativo), 690);
  assert.equal(closure.revision_cierre.requiere_revision, true);
  const anomaly = await request('/alertas');
  expectStatus(anomaly);
  assert.equal(anomaly.data.resumen.cierres_semanales.total, 1);
  expectStatus(await generate(), 201);
  closure = await getClosure();
  assert.equal(closure.revision_cierre.requiere_revision, false);
  assert.equal(await prisma.gastoSemanalVehiculo.count({ where: { propietario_id: owner.id } }), generatedCount);
  console.log('OK: factura mixta, anexar viajes, comisión cliente + empresa + IR; cierre detecta diferencia 750 → 690 y se regenera sin duplicar sueldos.');

  await prisma.viaje.update({ where: { id: own.id }, data: { descripcion_carga: 'Solo corrección de texto' } });
  assert.equal((await getClosure()).revision_cierre.requiere_revision, false);
  assert.equal((await request('/alertas')).data.resumen.cierres_semanales.total, 0);
  await prisma.mantenimiento.create({ data: { propietario_id: owner.id, vehiculo_id: vehicle.id, tipo_mantenimiento_id: maintenanceType.id, fecha_mantenimiento: date('2026-06-18'), kilometraje_actual_vehiculo: 1000, costo_total: 50, costo_mano_obra: 50 } });
  closure = await getClosure();
  assert.equal(closure.revision_cierre.requiere_revision, true);
  assert.equal(Number(closure.resumen.totales.resultado_operativo), 640);
  expectStatus(await generate(), 201);
  assert.equal((await getClosure()).revision_cierre.requiere_revision, false);
  console.log('OK: corrección de texto no genera anomalía; mantenimiento posterior sí, ganancia 640 y regeneración consistente.');

  const first = await request(`/facturacion/${draft.data.id}/abonos`, { fecha: '2026-06-22', monto: 100, soporte: marker });
  expectStatus(first, 201);
  assert.equal((await prisma.viaje.findUniqueOrThrow({ where: { id: own.id } })).cobrado, false);
  expectStatus(await request(`/facturacion/${draft.data.id}/deshacer`, { version: closed.data.version }), 409);
  const concurrent = await Promise.all([1, 2].map(() => request(`/facturacion/${draft.data.id}/abonos`, { fecha: '2026-06-23', monto: 1310, soporte: marker })));
  assert.deepEqual(concurrent.map(item => item.status).sort(), [201, 400]);
  const paidOwn = await prisma.viaje.findUniqueOrThrow({ where: { id: own.id } });
  const paidExternal = await prisma.viajeProveedor.findUniqueOrThrow({ where: { id: external.id } });
  assert.equal(paidOwn.cobrado, true);
  assert.equal(paidExternal.cobrado, true);
  assert.equal(paidExternal.pagado_proveedor, false);
  assert.equal(Number(paidExternal.precio_pagar_proveedor), 400);
  assert.equal(Number(paidExternal.utilidad), 50);
  assert.equal(paidOwn.fecha_cobro?.toISOString().slice(0, 10), '2026-06-23');
  assert.equal((await getClosure()).revision_cierre.requiere_revision, false);
  expectStatus(await request(`/facturacion/${draft.data.id}/deshacer`, { version: closed.data.version }), 409);
  const future = await request('/cierres-semanales/generar-gastos', { ...filters, anio: 2099 });
  assert.ok(future.status >= 400 && future.status < 500);
  console.log('OK: abono parcial, cobro total, sobrepago concurrente bloqueado; pago a proveedor independiente y semanas futuras rechazadas.');

  const reversibleTrip = await prisma.viaje.create({ data: { propietario_id: owner.id, cliente_id: client.id, vehiculo_id: vehicle.id, conductor_id: driver.id, tarifa_ruta_id: tariff.id, fecha_salida: date('2026-06-26'), fecha_llegada: date('2026-06-27'), precio_flete: 100, precio_real_flete: 100, numeros_guia_remision: [marker + '-UNDO'] } });
  const reversibleBody = { ...body, numero: marker + '-UNDO', detalles: [{ ...details[0], id: String(reversibleTrip.id) }] };
  const undoPreview = await request('/facturacion/previsualizar', reversibleBody);
  expectStatus(undoPreview);
  const reversible = await request('/facturacion', { ...reversibleBody, neto_confirmado: Number(undoPreview.data.neto), total_facturar_confirmado: Number(undoPreview.data.total_facturar) });
  expectStatus(reversible, 201); invoices.push(BigInt(reversible.data.id));
  expectStatus(await request(`/facturacion/${reversible.data.id}/deshacer`, { version: reversible.data.version + 1 }), 409);
  const undone = await request(`/facturacion/${reversible.data.id}/deshacer`, { version: reversible.data.version });
  expectStatus(undone);
  assert.equal(undone.data.viajes_liberados, 1);
  const freed = await request('/facturacion/viajes?search=' + encodeURIComponent(marker + '-UNDO'));
  assert.equal(freed.data.total, 1);
  assert.equal(freed.data.items[0].id, String(reversibleTrip.id));
  console.log('OK: quitar viajes del borrador los libera; deshacer factura sin abonos vuelve a habilitar sus viajes, con control de versión.');

  const { chromium } = await import('../../frontend/node_modules/playwright/index.mjs');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && message.text().startsWith('ERROR')) errors.push(message.text()); });
      await page.route('**/auth/refresh', route => route.fulfill({ json: { token, usuario: { id: String(user.id), nombre: marker, es_super_admin: true }, contexto: { propietario_id: String(owner.id), rol: 'admin', es_propietario: true, es_intermediario: true }, propietarios: [] } }));
      await page.goto(`http://localhost:4200/${mobile ? 'movil' : 'app'}/cierre-semanal?anio=2026&numero_semana=25&vehiculo_id=${vehicle.id}`);
      await page.getByText('640.00', { exact: false }).first().waitFor();
      await page.getByText('ACEITE PRUEBA', { exact: true }).waitFor();
      if (mobile) {
        await page.goto(`http://localhost:4200/movil/viajes/${own.id}/editar`);
        await page.locator('[formControlName="precio_flete"]').waitFor();
        assert.equal(await page.locator('[formControlName="observaciones"]').count(), 0);
        assert.equal(await page.getByText(/^(Diesel|Diésel|Peajes|Utilidad|A facturar)$/).count(), 0);
        assert.equal(await page.locator('#mobile-facturar-a').count(), 1);
        await page.goto(`http://localhost:4200/movil/viajes-proveedores/${external.id}/editar`);
        await page.locator('[formControlName="precio_viaje"]').waitFor();
        assert.equal(await page.locator('[formControlName="precio_pagar_proveedor"], [formControlName="observaciones"]').count(), 0);
        await page.goto('http://localhost:4200/movil/mantenimientos/nuevo');
        await page.locator('#mobile-mantenimiento-vehiculos option').first().waitFor({ state: 'attached' });
        for (const id of ['mobile-mantenimiento-vehiculos', 'mobile-mantenimiento-tipos']) {
          const label = await page.locator(`#${id} option`).evaluateAll((options, expected) => options.map(option => (option as HTMLOptionElement).value).find(value => value.startsWith(expected)), id === 'mobile-mantenimiento-vehiculos' ? 'TEST1227' : 'ACEITE PRUEBA');
          assert.ok(label);
          await page.locator(`input[list="${id}"]`).fill(label);
        }
        assert.equal(await page.locator('[formControlName="proximo_mantenimiento_km"], [formControlName="proximo_mantenimiento_fecha"], [formControlName="actualizar_kilometraje_vehiculo"]').count(), 0);
        await page.locator('[formControlName="kilometraje_actual_vehiculo"]').fill('1234');
        await page.locator('[formControlName="costo_mano_obra"]').fill('25');
        const saved = page.waitForResponse(response => response.url().endsWith('/api/mantenimientos') && response.request().method() === 'POST');
        await page.getByRole('button', { name: 'Guardar mantenimiento', exact: true }).click();
        const result = await saved;
        assert.equal(result.status(), 201, await result.text());
        assert.equal(result.request().postDataJSON().actualizar_kilometraje_vehiculo, true);
        assert.equal((await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehicle.id } })).kilometraje_actual, 1234);
      } else {
        await page.goto('http://localhost:4200/app/reportes');
        await page.locator('.reports-travel-filters app-multi-select-filter').first().waitFor();
        const controls = await page.locator('.reports-travel-filters > *').evaluateAll(elements => elements.map(element => ({ x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y })));
        assert.equal(controls.length, 6);
        assert.ok(controls.every(item => Math.abs(item.y - controls[0].y) < 2), JSON.stringify(controls));
        assert.ok(controls.every((item, index) => index === 0 || item.x > controls[index - 1].x));
        await page.screenshot({ path: process.env.TEMP + '/transporte-viajes-filtros-compactos.png', fullPage: true });
        await page.goto('http://localhost:4200/app/dashboard');
        await page.getByRole('link', { name: 'Revisar cierre', exact: true }).first().waitFor();
        const review = page.getByRole('link', { name: 'Revisar cierre', exact: true }).first();
        const href = await review.getAttribute('href');
        assert.ok(href?.includes('vehiculo_id=' + vehicle.id));
        await review.click();
        await page.locator('[formControlName="vehiculo_id"]').waitFor();
        await page.waitForFunction(id => (document.querySelector('[formControlName="vehiculo_id"]') as HTMLSelectElement)?.value === id, String(vehicle.id));
        assert.equal(await page.locator('[formControlName="vehiculo_id"]').inputValue(), String(vehicle.id));
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
  console.log('OK: cierre web y móvil muestran los datos reales de la API de prueba, sin errores de JavaScript.');
} finally {
  if (ownerId) {
    const owner = await prisma.propietario.findUniqueOrThrow({ where: { id: ownerId } });
    assert.equal(owner.nombre, marker, 'Protección de limpieza: propietario inesperado');
    const ids = (await prisma.facturaTransporte.findMany({ where: { propietario_id: ownerId }, select: { id: true } })).map(item => item.id);
    await prisma.$transaction(async tx => {
      await tx.abonoFacturaTransporte.deleteMany({ where: { factura_id: { in: ids } } });
      await tx.detalleFacturaTransporte.deleteMany({ where: { factura_id: { in: ids } } });
      await tx.facturaTransporte.deleteMany({ where: { propietario_id: ownerId } });
      await tx.cierreSemanal.deleteMany({ where: { propietario_id: ownerId } });
      await tx.gastoSemanalVehiculo.deleteMany({ where: { propietario_id: ownerId } });
      await tx.mantenimiento.deleteMany({ where: { propietario_id: ownerId } });
      await tx.viaje.deleteMany({ where: { propietario_id: ownerId } });
      await tx.viajeProveedor.deleteMany({ where: { propietario_id: ownerId } });
      await tx.configuracionFacturacion.deleteMany({ where: { cliente: { propietario_id: ownerId } } });
      await tx.configuracionOperativa.deleteMany({ where: { propietario_id: ownerId } });
      await tx.tarifaRuta.deleteMany({ where: { propietario_id: ownerId } });
      await tx.ruta.deleteMany({ where: { propietario_id: ownerId } });
      await tx.tipoCarga.deleteMany({ where: { propietario_id: ownerId } });
      await tx.tipoMantenimiento.deleteMany({ where: { propietario_id: ownerId } });
      await tx.vehiculo.deleteMany({ where: { propietario_id: ownerId } });
      await tx.categoriaPeaje.deleteMany({ where: { propietario_id: ownerId } });
      await tx.conductor.deleteMany({ where: { propietario_id: ownerId } });
      await tx.proveedor.deleteMany({ where: { propietario_id: ownerId } });
      await tx.cliente.deleteMany({ where: { propietario_id: ownerId } });
      await tx.auditoriaEvento.deleteMany({ where: { OR: [{ propietario_id: ownerId }, { entidad: 'facturacion', entidad_id: { in: ids.map(String) } }] } });
      if (sessionId) await tx.sesionUsuario.deleteMany({ where: { id: sessionId, propietario_id: ownerId } });
      await tx.propietario.delete({ where: { id: ownerId } });
    }, { timeout: 20000 });
  }
  try {
    assert.equal(await fingerprint(), before, 'Los registros existentes deben conservarse íntegros');
    console.log('OK: datos temporales eliminados; huella SHA-256 de registros existentes sin cambios.');
  } finally { await prisma.$disconnect(); }
}
