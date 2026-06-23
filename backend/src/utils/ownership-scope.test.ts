import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from './app-error.js';
import {
  assertCanWriteScopedRecord,
  resolveReadScope,
  resolveWriteOwnerId
} from './ownership-scope.js';

describe('ownership scope', () => {
  it('permite lectura global al super admin sin contexto', () => {
    const scope = resolveReadScope({ usuario_id: '1', es_super_admin: true });

    assert.equal(scope.all, true);
    assert.equal(scope.propietarioId, undefined);
  });

  it('limita lectura y escritura al propietario del token', () => {
    const user = { usuario_id: '10', propietario_id: '25', rol: 'admin' };

    assert.deepEqual(resolveReadScope(user), {
      all: false,
      propietarioId: 25n
    });
    assert.equal(resolveWriteOwnerId(user), 25n);
  });

  it('rechaza modificar registros globales sin super admin', () => {
    assert.throws(
      () => assertCanWriteScopedRecord({ usuario_id: '10', propietario_id: '25' }, null),
      (error) => error instanceof AppError && error.statusCode === 403
    );
  });

  it('rechaza modificar datos de otro propietario', () => {
    assert.throws(
      () => assertCanWriteScopedRecord({ usuario_id: '10', propietario_id: '25' }, 26n),
      (error) => error instanceof AppError && error.statusCode === 403
    );
  });

  it('permite al super admin crear registros globales', () => {
    assert.equal(resolveWriteOwnerId({ usuario_id: '1', es_super_admin: true }, true), null);
  });
});
