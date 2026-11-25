import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { PrismaClient } from '@prisma/client';

const backup = resolve(process.argv[2] ?? '');
const backupsRoot = resolve('..', 'backups');
assert.ok(backup.startsWith(backupsRoot + sep) && backup.endsWith('.dump') && existsSync(backup), 'Indica un respaldo .dump dentro de backups/');
const sourceUrl = new URL(process.env.DATABASE_URL!);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(sourceUrl.hostname), 'El ensayo solo puede crear bases locales');
const database = `release_rehearsal_${randomUUID().replaceAll('-', '')}`;
assert.ok(/^release_rehearsal_[a-f0-9]{32}$/.test(database));
assert.notEqual(sourceUrl.pathname.slice(1), database);
const targetUrl = new URL(sourceUrl);
targetUrl.pathname = '/' + database;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.href } }, log: ['error'] });
const target = new PrismaClient({ datasources: { db: { url: targetUrl.href } }, log: ['error'] });
const pgRestore = process.env.PG_RESTORE_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/16/bin/pg_restore.exe' : 'pg_restore');
const migrationsPath = resolve('prisma/migrations');
const localMigrations = readdirSync(migrationsPath).filter(name => /^\d{14}_/.test(name)).sort();
const normalize = (value: unknown) => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? String(item) : item);
const inventory = async () => target.$transaction(async tx => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const tables = await tx.$queryRawUnsafe<{ name: string }[]>("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename");
  const snapshots: Record<string, unknown> = {};
  for (const { name } of tables) {
    assert.ok(/^[a-z_]+$/.test(name));
    snapshots[name] = (await tx.$queryRawUnsafe(`SELECT count(*)::text AS rows, md5(COALESCE(jsonb_agg(to_jsonb(t) - 'facturar_a_id' - 'ruta_inversa' ORDER BY t.id)::text, '[]')) AS hash FROM public."${name}" t`));
  }
  return snapshots;
}, { isolationLevel: 'RepeatableRead', timeout: 60000 });
let created = false;
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
  created = true;
  execFileSync(pgRestore, ['--exit-on-error', '--no-owner', '--no-acl', '--dbname', database, backup], {
    env: { ...process.env, PGHOST: sourceUrl.hostname, PGPORT: sourceUrl.port || '5432', PGUSER: decodeURIComponent(sourceUrl.username), PGPASSWORD: decodeURIComponent(sourceUrl.password) },
    stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000
  });
  console.log('OK: respaldo restaurado en una base local desechable.');
  const applied = await target.$queryRawUnsafe<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }[]>('SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at');
  for (const item of applied.filter(item => !item.rolled_back_at)) {
    assert.ok(item.finished_at, `Migracion incompleta: ${item.migration_name}`);
    assert.ok(localMigrations.includes(item.migration_name), `Migracion desconocida: ${item.migration_name}`);
    const sql = readFileSync(join(migrationsPath, item.migration_name, 'migration.sql'), 'utf8');
    const lf = sql.replace(/\r\n/g, '\n');
    // Git on Windows may only change line endings; never accept changed SQL content.
    const digests = [sql, lf, lf.replace(/\n/g, '\r\n')].map(value => createHash('sha256').update(value).digest('hex'));
    assert.ok(digests.includes(item.checksum), `Cambio el SQL de una migracion ya aplicada: ${item.migration_name}`);
  }
  const pending = localMigrations.filter(name => !applied.some(item => item.migration_name === name && item.finished_at && !item.rolled_back_at));
  const before = await inventory();
  execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: targetUrl.href }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
  const after = await inventory();
  for (const table of Object.keys(before)) assert.equal(normalize(after[table]), normalize(before[table]), `Cambios inesperados en registros historicos: ${table}`);
  const counts = await target.$queryRawUnsafe<{ facturas: bigint; abonos: bigint; detalles: bigint; destinatarios_propios: bigint; destinatarios_proveedores: bigint }[]>(`SELECT
    (SELECT count(*) FROM facturas_transporte) AS facturas,
    (SELECT count(*) FROM abonos_facturas_transporte) AS abonos,
    (SELECT count(*) FROM detalles_facturas_transporte) AS detalles,
    (SELECT count(*) FROM viajes WHERE facturar_a_id IS NOT NULL) AS destinatarios_propios,
    (SELECT count(*) FROM viajes_proveedor WHERE facturar_a_id IS NOT NULL) AS destinatarios_proveedores`);
  if (!before['facturas_transporte']) {
    for (const value of Object.values(counts[0]!)) assert.equal(String(value), '0', 'No deben inventarse facturas, abonos o destinatarios historicos');
  }
  // A second deployment must not reapply migrations or alter business rows.
  execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: targetUrl.href }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
  assert.equal(normalize(await inventory()), normalize(after));
  const report = { verified_at: new Date().toISOString(), backup_sha256: createHash('sha256').update(readFileSync(backup)).digest('hex'), migrations: pending, preserved_tables: Object.keys(before), historical_counts: counts[0], before, after, second_deploy_unchanged: true };
  writeFileSync(join(dirname(backup), 'rehearsal-report.json'), normalize(report) + '\n', { mode: 0o600 });
  console.log(`OK: ${pending.length} migraciones aplicadas; ${Object.keys(before).length} tablas originales conservadas.`);
  console.log('OK: viajes cobrados/pagados, importes y cierres intactos; sin facturas artificiales ni destinatarios asignados.');
  console.log('OK: segundo migrate deploy sin cambios; informe junto al respaldo.');
} finally {
  await target.$disconnect();
  try {
    if (created) {
      // This exact generated name is never supplied by the user or read from a backup.
      assert.ok(/^release_rehearsal_[a-f0-9]{32}$/.test(database));
      await admin.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
      console.log('OK: base desechable eliminada; bases originales sin modificar.');
    }
  } finally { await admin.$disconnect(); }
}
