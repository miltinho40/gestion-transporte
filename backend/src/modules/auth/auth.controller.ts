import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { acceptInvitation, login, getMe } from './auth.service.js';

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const result = await login(req.body);
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
