import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { chromium } from '../frontend/node_modules/playwright/index.mjs';

// Public checks only. Never create invoices, payments, trips or sessions here.
const base = 'https://disco-song-382013.web.app';
const output = resolve(process.argv[2] ?? 'backups/production-smoke');
assert.ok(output.startsWith(resolve('backups') + sep));
mkdirSync(output, { recursive: true });
const localRoot = resolve('frontend/dist/frontend/browser');
const localHtml = readFileSync(resolve(localRoot, 'index.html'), 'utf8');
const deployed = await fetch(base + '/?release-smoke=' + Date.now());
assert.equal(deployed.status, 200);
const deployedHtml = await deployed.text();
const main = localHtml.match(/src="(main-[^"]+\.js)"/)?.[1];
assert.ok(main && deployedHtml.includes(main), 'Hosting debe servir el build local validado');
const assets = [...localHtml.matchAll(/(?:src|href)="([^"/][^"]+\.(?:js|css))"/g)].map(match => match[1]);
for (const path of assets) {
  assert.ok(resolve(localRoot, path).startsWith(localRoot + sep));
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  const digest = value => createHash('sha256').update(value).digest('hex');
  assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(readFileSync(resolve(localRoot, path))), `Asset distinto: ${path}`);
}
assert.equal((await (await fetch(base + '/api/health')).json()).database, 'ok');
for (const path of ['/api/facturacion/configuracion', '/api/facturacion/viajes']) {
  assert.equal((await fetch(base + path)).status, 401, 'La nueva API debe existir y exigir sesion');
}
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && message.text().startsWith('ERROR')) errors.push(message.text()); });
    await page.goto(base + (mobile ? '/movil/viajes' : '/app/facturacion'));
    await page.locator('#password').waitFor();
    assert.ok(new URL(page.url()).pathname === '/login');
    assert.equal(await page.locator('#email').getAttribute('autocomplete'), 'username');
    assert.equal(await page.locator('#password').getAttribute('autocomplete'), 'current-password');
    assert.equal(await page.getByRole('button', { name: 'Entrar', exact: true }).count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Login sin desbordamiento horizontal');
    await page.screenshot({ path: resolve(output, mobile ? 'login-mobile.png' : 'login-desktop.png'), fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally { await browser.close(); }
console.log(`OK: Hosting sirve ${main}; ${assets.length} assets con SHA-256 identico al build local.`);
console.log('OK: API y BD disponibles; facturacion exige autenticacion; login web/movil sin errores JavaScript.');
console.log('No se probaron credenciales ni se modificaron registros de negocio.');
