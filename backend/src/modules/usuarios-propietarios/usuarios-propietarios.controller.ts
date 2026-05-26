import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  assignUsuarioPropietario,
  deactivateUsuarioPropietario,
  getUsuarioPropietarioById,
  listUsuariosPropietarios,
  updateUsuarioPropietario
} from './usuarios-propietarios.service.js';

export const listUsuariosPropietariosController = asyncHandler(
  async (req: Request, res: Response) => {
    const items = await listUsuariosPropietarios(req.query);
    res.json(serializeResponse(items));
  }
);

export const getUsuarioPropietarioController = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await getUsuarioPropietarioById(req.params.id);
    res.json(serializeResponse(item));
  }
);

export const assignUsuarioPropietarioController = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await assignUsuarioPropietario(req.body);
    res.status(201).json(serializeResponse(item));
  }
);

export const updateUsuarioPropietarioController = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await updateUsuarioPropietario(req.params.id, req.body);
    res.json(serializeResponse(item));
  }
);

export const deleteUsuarioPropietarioController = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await deactivateUsuarioPropietario(req.params.id);
    res.json(serializeResponse(item));
  }
);
