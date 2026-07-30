import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/gestion_transporte_test';
process.env.JWT_SECRET ??= 'test-secret-with-enough-length';

const { __testing } = await import('./auth.session.js');
const { normalizeIpAddress } = await import('../../utils/request-ip.js');

describe('seguridad de sesiones', () => {
  it('calcula hashes estables sin conservar el refresh token', () => {
    const token = 'refresh-token-de-prueba';
    const hash = __testing.refreshTokenHash(token);

    assert.equal(hash.length, 64);
    assert.equal(hash, __testing.refreshTokenHash(token));
    assert.notEqual(hash, token);
  });

  it('normaliza direcciones IPv4 representadas como IPv6', () => {
    assert.equal(normalizeIpAddress('::ffff:169.254.169.126'), '169.254.169.126');
    assert.equal(normalizeIpAddress('10.128.0.16'), '10.128.0.16');
    assert.equal(normalizeIpAddress(undefined), null);
  });
});
