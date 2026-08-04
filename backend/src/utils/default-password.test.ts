import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import bcrypt from 'bcryptjs';

const {
  generateHashedTemporaryPassword,
  generateTemporaryPassword
} = await import('./default-password.js');

describe('contraseñas temporales', () => {
  it('genera claves aleatorias con complejidad mínima', () => {
    const passwords = new Set(
      Array.from({ length: 20 }, () => generateTemporaryPassword())
    );

    assert.equal(passwords.size, 20);
    for (const password of passwords) {
      assert.ok(password.length >= 12);
      assert.match(password, /[A-Z]/);
      assert.match(password, /[a-z]/);
      assert.match(password, /\d/);
      assert.match(password, /[!@#$%*_-]/);
    }
  });

  it('entrega la clave visible junto con un hash válido', async () => {
    const result = await generateHashedTemporaryPassword();

    assert.notEqual(result.password, result.hash);
    assert.equal(await bcrypt.compare(result.password, result.hash), true);
  });
});
