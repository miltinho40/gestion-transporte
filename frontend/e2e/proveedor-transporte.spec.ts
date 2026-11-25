import { expect, test } from '@playwright/test';
import { providerTripFixture } from '../src/app/pages/proveedor-transporte/proveedor-transporte.testing';

test('proveedores: edición, duplicación, guías, cobro y pago conservan sus contratos', async ({
  page
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Flujo web; móvil se verifica por separado.');
  const source = providerTripFixture({
    cobrado: false,
    pagado_proveedor: false,
    fecha_cobro: null,
    fecha_pago_proveedor: null
  });
  const rows = new Map([[source.id, structuredClone(source)]]);
  const writes: { method: string; path: string; body: any }[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().startsWith('ERROR'))
      errors.push(message.text());
  });
  await page.addInitScript(
    "Object.defineProperty(navigator,'clipboard',{value:{write:async(items)=>{window.__providerPng=await items[0].getType('image/png');}}});"
  );
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace('/api', '');
    const method = request.method();
    if (path === '/auth/refresh')
      return route.fulfill({
        json: {
          token: 'test-local-only',
          usuario: { id: '1', nombre: 'Prueba', es_super_admin: true },
          contexto: {
            propietario_id: '1',
            rol: 'admin',
            es_propietario: true,
            es_intermediario: true
          },
          propietarios: []
        }
      });
    if (path === '/clientes')
      return route.fulfill({
        json: [source.cliente, { ...source.cliente, id: '4', nombre: 'TRASOSA' }]
      });
    if (path === '/proveedores') return route.fulfill({ json: [source.proveedor] });
    if (path === '/tarifas-ruta') return route.fulfill({ json: [source.tarifa_ruta] });
    if (!path.startsWith('/viajes-proveedor'))
      return route.fulfill({ status: 400, json: { message: 'Ruta no simulada' } });
    if (path === '/viajes-proveedor' && method === 'GET') {
      const filtered = [...rows.values()].filter(
        (row) =>
          url.searchParams.get('mostrar_finalizados') !== 'false' ||
          !row.cobrado ||
          !row.pagado_proveedor
      );
      return route.fulfill({
        json: {
          data: filtered,
          meta: {
            page: 1,
            limit: 25,
            total: filtered.length,
            total_pages: 1,
            has_next: false,
            has_previous: false
          }
        }
      });
    }
    const id = path.split('/')[2],
      operation = path.split('/')[3];
    if (method === 'GET') return route.fulfill({ json: rows.get(id) });
    const body = method === 'DELETE' ? null : request.postDataJSON();
    writes.push({ method, path, body });
    if (method === 'POST') {
      const row = {
        ...structuredClone(source),
        ...body,
        numeros_guia_remision: String(body.numeros_guia_remision)
          .split(/[,\-]+/)
          .map((s) => s.trim()),
        id: '20',
        cobrado: false,
        pagado_proveedor: false
      };
      rows.set(row.id, row);
      return route.fulfill({ status: 201, json: row });
    }
    const row = rows.get(id)!;
    if (method === 'PUT')
      Object.assign(row, body, {
        numeros_guia_remision: String(body.numeros_guia_remision)
          .split(/[,\-]+/)
          .map((s) => s.trim())
      });
    if (operation === 'guias')
      row.numeros_guia_remision.push(
        ...body.numeros_guia_remision.split(/[,\-]+/).map((s: string) => s.trim())
      );
    if (operation === 'cobro') row.cobrado = body.cobrado !== false;
    if (operation === 'pago') row.pagado_proveedor = true;
    return route.fulfill({ json: row });
  });
  await page.goto('/app/proveedores/transporte');
  const table = page.locator('.provider-table');
  await expect(table.getByRole('checkbox', { name: 'Seleccionar viaje', exact: true })).toHaveCount(
    1
  );
  await table.getByTitle('Editar', { exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.locator('#fecha_llegada')).toHaveValue('2026-11-06');
  await modal.locator('#fecha_llegada').fill('2026-12-01');
  await modal.locator('#fecha_salida').fill('2026-11-25');
  await expect(modal.locator('#fecha_llegada')).toHaveValue('2026-12-01');
  await modal.locator('#descripcion_carga').fill('Detalle editado');
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(modal).toBeHidden();
  expect(writes[0].method).toBe('PUT');
  expect(writes[0].body.descripcion_carga).toBe('Detalle editado');
  for (const field of ['estado', 'cobrado', 'fecha_cobro', 'valor_a_facturar'])
    expect(writes[0].body).not.toHaveProperty(field);

  await table.getByTitle('Duplicar', { exact: true }).click();
  await expect(
    modal.getByRole('heading', { name: 'Nuevo viaje de proveedor', exact: true })
  ).toBeVisible();
  await expect(modal.locator('#pagado_proveedor')).not.toBeChecked();
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(modal).toBeHidden();
  expect(writes.find((write) => write.method === 'POST')?.body.cliente_id).toBe(source.cliente_id);
  await expect(table.getByRole('checkbox', { name: 'Seleccionar viaje', exact: true })).toHaveCount(
    2
  );
  rows.delete('20');
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(table.getByRole('checkbox', { name: 'Seleccionar viaje', exact: true })).toHaveCount(
    1
  );

  await table.getByTitle('Agregar guías', { exact: true }).click();
  await table.getByPlaceholder('Guías por coma o guion').fill('777, 888-999');
  await table.locator('.guide-input button').first().click();
  await expect(table.getByPlaceholder('Guías por coma o guion')).toBeHidden();
  expect(writes.find((write) => write.path.endsWith('/guias'))?.body.numeros_guia_remision).toBe(
    '777, 888-999'
  );
  await table.getByRole('checkbox', { name: 'Seleccionar viaje', exact: true }).check();
  await page.getByRole('button', { name: /Marcar pagados/ }).click();
  await page.locator('#support-no-invoice').check();
  await page.getByRole('button', { name: 'Marcar pagados', exact: true }).click();
  await expect(table.locator('.provider-row-paid-uncollected')).toHaveCount(1);
  expect(writes.filter((write) => write.path.endsWith('/cobro'))).toHaveLength(0);
  await table.getByRole('checkbox', { name: 'Seleccionar viaje', exact: true }).check();
  await page.getByRole('button', { name: /Marcar cobrados/ }).click();
  await page.locator('#support-number').fill('FACT-TEST');
  await page.getByRole('button', { name: 'Marcar cobrados', exact: true }).click();
  await expect(table.getByRole('checkbox', { name: 'Seleccionar viaje', exact: true })).toHaveCount(
    0
  );
  await page.getByRole('checkbox', { name: 'Mostrar cobrados y pagados', exact: true }).check();
  await expect(table.locator('.provider-row-balanced')).toHaveCount(1);
  await table.getByTitle('Regresar a sin cobrar').click();
  await page.getByRole('button', { name: 'Sí, regresar', exact: true }).click();
  await expect(table.locator('.provider-row-paid-uncollected')).toHaveCount(1);
  await table.getByRole('checkbox', { name: 'Seleccionar viaje', exact: true }).check();
  await page.getByRole('button', { name: 'Copiar y enviar', exact: true }).click();
  await expect.poll(() => page.evaluate('window.__providerPng?.type')).toBe('image/png');
  await page.screenshot({ path: info.outputPath('proveedores-lista.png'), fullPage: true });
  await table.getByTitle('Editar', { exact: true }).click();
  await page.screenshot({ path: info.outputPath('proveedores-editor.png'), fullPage: true });
  expect(errors).toEqual([]);
});
