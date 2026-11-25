import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('..');
execFileSync('git', ['diff', '--check'], { cwd: root, stdio: 'pipe' });
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/);
const patterns = [
  /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];
const flagged = new Set<string>();
for (const file of files) {
  if (/(^|\/)\.env(?:\..*)?$/.test(file) && !file.endsWith('.example')) flagged.add(file);
  if (/\.(dump|p12|pfx|sql\.gz)$/.test(file)) flagged.add(file);
  const path = resolve(root, file);
  if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size > 2000000) continue;
  const text = readFileSync(path, 'utf8');
  if (!text.includes('\0') && patterns.some(pattern => pattern.test(text))) flagged.add(file);
}
if (flagged.size) {
  console.error('Revisar archivos sensibles antes de Git (no se imprimen sus valores):');
  for (const file of flagged) console.error(file);
  process.exitCode = 1;
} else console.log(`OK: ${files.length} archivos candidatos revisados; sin claves privadas, claves OpenAI ni respaldos detectados. Esta comprobacion no sustituye revisar el diff.`);
for (const file of ['backend/.env', 'backups/release/database.dump']) {
  assert.ok(execFileSync('git', ['check-ignore', file], { cwd: root, encoding: 'utf8' }).trim(), `Debe excluirse de Git: ${file}`);
}
console.log('OK: .env y respaldos fuera de Git; diff sin errores de espacios.');
