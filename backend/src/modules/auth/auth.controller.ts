import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { auditContextFromRequest, recordAuditEvent } from '../../utils/audit.js';
import { acceptInvitation, changePassword, login, getMe } from './auth.service.js';

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const result = await login(req.body, { clientIp: req.ip });
  await recordAuditEvent({
    propietarioId: result.contexto?.propietario_id,
    usuarioId: result.usuario.id,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? null,
    entidad: 'auth',
    accion: 'login',
    resumen: `Inicio de sesión: ${result.usuario.email}`,
    despues: {
      usuario: result.usuario,
      contexto: result.contexto
    }
  });
  res.json(result);
});

export const meController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMe(req.user!.usuario_id, req.user?.propietario_id);
  res.json(result);
});

export const acceptInvitationController = asyncHandler(async (req: Request, res: Response) => {
  const result = await acceptInvitation(req.body);
  res.json(result);
});

export const changePasswordController = asyncHandler(async (req: Request, res: Response) => {
  const result = await changePassword(req.user!.usuario_id, req.body);
  await recordAuditEvent({
    ...auditContextFromRequest(req),
    entidad: 'auth',
    accion: 'cambiar_clave',
    resumen: 'Cambio de clave del usuario logueado'
  });
  res.json(result);
});
