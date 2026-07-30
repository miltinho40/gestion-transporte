import { expect, test } from '@playwright/test';

test('inicia sesión y conserva la sesión al recargar', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('propietario1@demo.test');
  await page.getByLabel('Clave').fill('demo123456');
  await page.getByRole('button', { name: /entrar/i }).click();

  await expect(page).toHaveURL(/\/(app\/dashboard|movil\/viajes)$/);
  await expect(page.getByText('TRANSPORTE ANDINO DEMO').first()).toBeVisible();

  const storedSession = await page.evaluate(() =>
    localStorage.getItem('gestion_transporte_session')
  );
  expect(storedSession).not.toContain('access-token');
  expect(JSON.parse(storedSession ?? '{}').token).toBeNull();

  await page.reload();
  await expect(page).not.toHaveURL(/\/login$/);
});

test('rechaza credenciales incorrectas sin revelar el usuario', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('propietario1@demo.test');
  await page.getByLabel('Clave').fill('clave-incorrecta');
  await page.getByRole('button', { name: /entrar/i }).click();

  await expect(page.getByText('Credenciales invalidas')).toBeVisible();
});
