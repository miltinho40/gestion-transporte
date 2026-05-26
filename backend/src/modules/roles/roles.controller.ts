import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import { getRolById, listRoles } from './roles.service.js';

export const listRolesController = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await listRoles();
  res.json(serializeResponse(roles));
});

export const getRolController = asyncHandler(async (req: Request, res: Response) => {
  const rol = await getRolById(req.params.id);
  res.json(serializeResponse(rol));
});
