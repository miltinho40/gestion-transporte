import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createPropietario,
  deactivatePropietario,
  getPropietarioById,
  listPropietarios,
  updateEstadoPropietario,
  updatePropietario
} from './propietarios.service.js';

export const listPropietariosController = asyncHandler(async (req: Request, res: Response) => {
  const propietarios = await listPropietarios(req.query);
  res.json(serializeResponse(propietarios));
});

export const getPropietarioController = asyncHandler(async (req: Request, res: Response) => {
  const propietario = await getPropietarioById(req.params.id);
  res.json(serializeResponse(propietario));
});

export const createPropietarioController = asyncHandler(async (req: Request, res: Response) => {
  const propietario = await createPropietario(req.body);
  res.status(201).json(serializeResponse(propietario));
});

export const updatePropietarioController = asyncHandler(async (req: Request, res: Response) => {
  const propietario = await updatePropietario(req.params.id, req.body);
  res.json(serializeResponse(propietario));
});

export const updateEstadoPropietarioController = asyncHandler(
  async (req: Request, res: Response) => {
    const propietario = await updateEstadoPropietario(req.params.id, req.body);
    res.json(serializeResponse(propietario));
  }
);

export const deletePropietarioController = asyncHandler(async (req: Request, res: Response) => {
  const propietario = await deactivatePropietario(req.params.id);
  res.json(serializeResponse(propietario));
});
