import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@local.test');
  await page.getByLabel('Clave').fill('admin123456');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login$/);
});

test('crea viajes sobre el reporte y conserva sus filtros al cancelar', async ({ page }) => {
  await page.goto('/app/reportes?anio=2026&cobrado=todos&q=VINCES&semanas=22');

  await expect(page.getByRole('heading', { name: 'Viajes', level: 1 })).toBeVisible();
  await expect(page.getByPlaceholder(/Buscar por cliente/i)).toHaveValue('VINCES');

  await page.getByRole('button', { name: 'Nuevo viaje', exact: true }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nuevo viaje' })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/reportes/);
  await expect(page).toHaveURL(/q=VINCES/);
  await expect(page).toHaveURL(/semanas=22/);

  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByPlaceholder(/Buscar por cliente/i)).toHaveValue('VINCES');
  await expect(page).toHaveURL(/\/app\/reportes/);
  await expect(page).toHaveURL(/q=VINCES/);
  await expect(page).toHaveURL(/semanas=22/);
});

test('la ruta web antigua redirige al reporte unificado', async ({ page }) => {
  await page.goto('/app/viajes');

  await expect(page).toHaveURL(/\/app\/reportes$/);
  await expect(page.getByRole('heading', { name: 'Viajes', level: 1 })).toBeVisible();
});
