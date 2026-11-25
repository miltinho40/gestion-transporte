import { expect, test } from '@playwright/test';
import { weeklyClosureFixture } from '../src/app/pages/weekly-closure/weekly-closure.testing';

test('cierre semanal conserva resumen, orden, exportación y restricciones', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile-chromium';
  const path = mobile ? '/movil/cierre-semanal' : '/app/cierre-semanal';
  let data = weeklyClosureFixture();
  const writes: unknown[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().startsWith('ERROR'))
      errors.push(message.text());
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async (items: ClipboardItem[]) => {
          (window as any).__closurePng = await items[0].getType('image/png');
        },
      },
    });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace('/api', '');
    if (endpoint === '/auth/refresh')
      return route.fulfill({
        json: {
          token: 'test-local-only',
          usuario: { id: '1', nombre: 'Prueba', es_super_admin: true },
          contexto: {
            propietario_id: '1',
            rol: 'admin',
            es_propietario: true,
            es_intermediario: true,
          },
          propietarios: [],
        },
      });
    if (endpoint === '/vehiculos') return route.fulfill({ json: [data.vehiculo] });
    if (endpoint === '/cierres-semanales') return route.fulfill({ json: data });
    if (endpoint === '/cierres-semanales/generar-gastos') {
      writes.push(request.postDataJSON());
      data.resumen.cantidad_gastos_generados = 2;
      data.revision_cierre!.requiere_revision = false;
      return route.fulfill({ json: { cierre: data } });
    }
    return route.fulfill({ status: 400, json: { message: 'Ruta no simulada' } });
  });
  await page.goto(path);
  const generate = page.locator('form button.btn-primary');
  await expect(page.locator('[formControlName="vehiculo_id"]')).toHaveValue('1');
  await expect(generate).toBeDisabled();
  await page.locator('[formControlName="anio"]').fill('2026');
  await page.locator('[formControlName="numero_semana"]').fill('25');
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  await expect(generate).toBeEnabled();
  const activities = mobile
    ? page.locator('.activity-card')
    : page.locator('app-weekly-closure-activity tbody tr');
  await expect(activities).toHaveCount(3);
  await expect(activities.nth(0)).toContainText('2026-06-20');
  await expect(activities.nth(1)).toContainText('2026-06-21');
  await expect(activities.nth(2)).toContainText('ACEITE');
  await expect(page.locator(mobile ? '.metric-grid' : '.row.g-3').first()).toContainText('256.00');
  await page.getByRole('button', { name: 'Copiar y enviar', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__closurePng?.size ?? 0))
    .toBeGreaterThan(1000);
  expect(await page.evaluate(() => (window as any).__closurePng.type)).toBe('image/png');
  const pixels = await page.evaluate(async () => {
    const bitmap = await createImageBitmap((window as any).__closurePng);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const values = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let i = 0; i < values.length; i += 400) {
      if (values[i] < 220 || values[i + 1] < 220 || values[i + 2] < 220) colored++;
    }
    bitmap.close();
    return { width: canvas.width, height: canvas.height, colored };
  });
  expect(pixels.width).toBe(2160);
  expect(pixels.height).toBeGreaterThan(500);
  expect(pixels.colored).toBeGreaterThan(100);
  await page.screenshot({ path: info.outputPath('cierre-semanal.png'), fullPage: true });

  await page.locator('[formControlName="numero_semana"]').fill('26');
  await expect(generate).toBeDisabled();
  await page.locator('[formControlName="numero_semana"]').fill('25');
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(generate).toBeDisabled();
  expect(writes).toEqual([{ anio: 2026, numero_semana: 25, vehiculo_id: '1' }]);

  data.revision_cierre!.requiere_revision = true;
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  await expect(generate).toHaveText(/Regenerar gastos/);
  await expect(generate).toBeEnabled();
  data = weeklyClosureFixture({
    semana: { anio: 2099, numero_semana: 25, fecha_inicio: '2099-06-15', fecha_fin: '2099-06-21' },
  });
  await page.locator('[formControlName="anio"]').fill('2099');
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  await expect(generate).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Copiar y enviar', exact: true })).toBeDisabled();
  expect(writes).toHaveLength(1);
  expect(errors).toEqual([]);
});
