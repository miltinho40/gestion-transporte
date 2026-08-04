import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-with-enough-length';
process.env.JWT_EXPIRES_IN ??= '15m';
process.env.REFRESH_TOKEN_EXPIRES_DAYS ??= '30';

const enabled = process.env.RUN_DB_INTEGRATION_TESTS === 'true';

describe(
  'sesiones de autenticación integradas',
  { skip: !enabled },
  () => {
    let prisma: typeof import('../../config/prisma.js').prisma;
    let login: typeof import('./auth.service.js').login;
    let refreshSession: typeof import('./auth.service.js').refreshSession;
    let revokeUserSession: typeof import('./auth.session.js').revokeUserSession;
    let verifyToken: typeof import('../../config/jwt.js').verifyToken;
    let usuarioId: bigint;
    let propietarioId: bigint;
    let rolId: bigint;

    before(async () => {
      ({ prisma } = await import('../../config/prisma.js'));
      ({ login, refreshSession } = await import('./auth.service.js'));
      ({ revokeUserSession } = await import('./auth.session.js'));
      ({ verifyToken } = await import('../../config/jwt.js'));

      const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const rol = await prisma.rol.create({
        data: { nombre: `test-auth-${suffix}`, permisos: [] }
      });
      rolId = rol.id;
      const propietario = await prisma.propietario.create({
        data: {
          nombre: `PROPIETARIO TEST ${suffix}`,
          ruc_cedula: `T${suffix}`.slice(0, 20)
        }
      });
      propietarioId = propietario.id;
      const usuario = await prisma.usuario.create({
        data: {
          nombre: 'USUARIO SESION TEST',
          email: `auth-${suffix}@example.test`,
          password_hash: await bcrypt.hash('ClaveSegura123!', 12),
          email_verificado: true,
          activo: true
        }
      });
      usuarioId = usuario.id;
      await prisma.usuarioPropietario.create({
        data: {
          usuario_id: usuario.id,
          propietario_id: propietario.id,
          rol_id: rol.id
        }
      });
    });

    after(async () => {
      if (!prisma) return;
      await prisma.sesionUsuario.deleteMany({ where: { usuario_id: usuarioId } });
      await prisma.usuarioPropietario.deleteMany({ where: { usuario_id: usuarioId } });
      await prisma.usuario.delete({ where: { id: usuarioId } });
      await prisma.propietario.delete({ where: { id: propietarioId } });
      await prisma.rol.delete({ where: { id: rolId } });
      await prisma.$disconnect();
    });

    it('crea, rota y revoca una sesión', async () => {
      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: usuarioId }
      });
      const authenticated = await login(
        {
          email: usuario.email,
          password: 'ClaveSegura123!',
          propietario_id: propietarioId.toString()
        },
        { clientIp: '127.0.0.1', userAgent: 'node:test' }
      );
      const firstPayload = verifyToken(authenticated.token);

      assert.ok(firstPayload.sesion_id);
      assert.equal(firstPayload.usuario_id, usuarioId.toString());

      const refreshed = await refreshSession(authenticated.refresh_token);
      const secondPayload = verifyToken(refreshed.token);
      assert.equal(secondPayload.sesion_id, firstPayload.sesion_id);

      await assert.rejects(
        refreshSession(authenticated.refresh_token),
        /sesión expiró/i
      );

      await revokeUserSession(refreshed.refresh_token);
      await assert.rejects(
        refreshSession(refreshed.refresh_token),
        /sesión expiró/i
      );
    });
  }
);
