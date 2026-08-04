import { expect, test } from '@playwright/test';

test('muestra el panel de evaluaciones del asistente', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@local.test');
  await page.getByLabel('Clave').fill('admin123456');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login$/);

  await page.goto('/app/asistente/evaluaciones');

  await expect(page.getByRole('heading', { name: 'Evaluaciones IA', level: 1 })).toBeVisible();
  await expect(page.getByText('Respuestas correctas')).toBeVisible();
  await expect(page.getByText('Pendientes de revisión')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Pregunta' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Respuesta y corrección' })).toBeVisible();
});
