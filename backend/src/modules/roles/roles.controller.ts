import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import { createRol, deleteRol, getRolById, listRoles, updateRol } from './roles.service.js';

export const listRolesController = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await listRoles();
  res.json(serializeResponse(roles));
});

export const getRolController = asyncHandler(async (req: Request, res: Response) => {
  const rol = await getRolById(req.params.id);
  res.json(serializeResponse(rol));
});

export const createRolController = asyncHandler(async (req: Request, res: Response) => {
  const rol = await createRol(req.body);
  res.status(201).json(serializeResponse(rol));
});

export const updateRolController = asyncHandler(async (req: Request, res: Response) => {
  const rol = await updateRol(req.params.id, req.body);
  res.json(serializeResponse(rol));
});

export const deleteRolController = asyncHandler(async (req: Request, res: Response) => {
  const rol = await deleteRol(req.params.id);
  res.json(serializeResponse(rol));
});
