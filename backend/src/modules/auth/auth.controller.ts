import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { auditContextFromRequest, recordAuditEvent } from '../../utils/audit.js';
import { clientIpFromRequest } from '../../utils/request-ip.js';
import {
  clearRefreshCookie,
  readCookie,
  REFRESH_COOKIE_NAME,
  revokeUserSession,
  setRefreshCookie
} from './auth.session.js';
import {
  acceptInvitation,
  changePassword,
  getMe,
  login,
  refreshSession
} from './auth.service.js';

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const result = await login(req.body, {
    clientIp: clientIpFromRequest(req),
    userAgent: req.get('user-agent') ?? null
  });
  const { refresh_token: refreshToken, ...response } = result;
  setRefreshCookie(res, refreshToken);
  await recordAuditEvent({
    propietarioId: response.contexto?.propietario_id,
    usuarioId: response.usuario.id,
    ip: clientIpFromRequest(req),
    userAgent: req.get('user-agent') ?? null,
    entidad: 'auth',
    accion: 'login',
    resumen: `Inicio de sesión: ${response.usuario.email}`,
    despues: {
      usuario: response.usuario,
      contexto: response.contexto
    }
  });
  res.json(response);
});

export const meController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMe(
    req.user!.usuario_id,
    req.user?.propietario_id,
    req.user!.sesion_id!
  );
  res.json(result);
});

export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = readCookie(req, REFRESH_COOKIE_NAME);
  if (!refreshToken) {
    clearRefreshCookie(res);
    res.status(401).json({ message: 'Sesión no disponible' });
    return;
  }

  const result = await refreshSession(refreshToken, {
    clientIp: clientIpFromRequest(req),
    userAgent: req.get('user-agent') ?? null
  });
  const { refresh_token: nextRefreshToken, ...response } = result;
  setRefreshCookie(res, nextRefreshToken);
  res.json(response);
});

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  await revokeUserSession(readCookie(req, REFRESH_COOKIE_NAME));
  clearRefreshCookie(res);
  res.status(204).send();
});

export const acceptInvitationController = asyncHandler(async (req: Request, res: Response) => {
  const result = await acceptInvitation(req.body);
  res.json(result);
});

export const changePasswordController = asyncHandler(async (req: Request, res: Response) => {
  const result = await changePassword(
    req.user!.usuario_id,
    req.body,
    req.user?.sesion_id
  );
  await recordAuditEvent({
    ...auditContextFromRequest(req),
    entidad: 'auth',
    accion: 'cambiar_clave',
    resumen: 'Cambio de clave del usuario logueado'
  });
  res.json(result);
});
