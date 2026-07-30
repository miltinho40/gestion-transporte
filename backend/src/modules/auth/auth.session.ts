import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';

export const REFRESH_COOKIE_NAME = 'gestion_transporte_refresh';

const refreshTokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const newRefreshToken = () => randomBytes(48).toString('base64url');

const refreshExpiration = () => {
  const expiration = new Date();
  expiration.setUTCDate(
    expiration.getUTCDate() + env.REFRESH_TOKEN_EXPIRES_DAYS
  );
  return expiration;
};

export const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
});

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...refreshCookieOptions(),
    maxAge: undefined
  });
};

export const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
};

export const readCookie = (req: Request, name: string) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return null;
};

export const createUserSession = async (input: {
  usuarioId: bigint;
  propietarioId?: bigint;
  ip?: string | null;
  userAgent?: string | null;
}) => {
  const token = newRefreshToken();
  const session = await prisma.sesionUsuario.create({
    data: {
      usuario_id: input.usuarioId,
      propietario_id: input.propietarioId,
      refresh_token_hash: refreshTokenHash(token),
      expira_en: refreshExpiration(),
      ip: input.ip,
      user_agent: input.userAgent
    }
  });

  return { session, token };
};

export const rotateUserSession = async (
  token: string,
  context?: { ip?: string | null; userAgent?: string | null }
) => {
  const now = new Date();
  const current = await prisma.sesionUsuario.findUnique({
    where: { refresh_token_hash: refreshTokenHash(token) }
  });
  if (
    !current ||
    current.revocada_en ||
    current.expira_en.getTime() <= now.getTime()
  ) {
    throw new AppError('La sesión expiró. Inicia sesión nuevamente', 401);
  }

  const nextToken = newRefreshToken();
  const updated = await prisma.sesionUsuario.update({
    where: { id: current.id },
    data: {
      refresh_token_hash: refreshTokenHash(nextToken),
      ultimo_uso_en: now,
      ip: context?.ip ?? current.ip,
      user_agent: context?.userAgent ?? current.user_agent
    }
  });
  return { session: updated, token: nextToken };
};

export const revokeUserSession = async (token: string | null) => {
  if (!token) return;
  await prisma.sesionUsuario.updateMany({
    where: {
      refresh_token_hash: refreshTokenHash(token),
      revocada_en: null
    },
    data: { revocada_en: new Date() }
  });
};

export const __testing = {
  refreshTokenHash
};
