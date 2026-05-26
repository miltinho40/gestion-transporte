import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createUsuario,
  deactivateUsuario,
  getUsuarioById,
  listUsuarios,
  updateEstadoUsuario,
  updatePasswordUsuario,
  updateUsuario
} from './usuarios.service.js';

export const listUsuariosController = asyncHandler(async (req: Request, res: Response) => {
  const usuarios = await listUsuarios(req.query);
  res.json(serializeResponse(usuarios));
});

export const getUsuarioController = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await getUsuarioById(req.params.id);
  res.json(serializeResponse(usuario));
});

export const createUsuarioController = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await createUsuario(req.body);
  res.status(201).json(serializeResponse(usuario));
});

export const updateUsuarioController = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await updateUsuario(req.params.id, req.body);
  res.json(serializeResponse(usuario));
});

export const updateEstadoUsuarioController = asyncHandler(
  async (req: Request, res: Response) => {
    const usuario = await updateEstadoUsuario(req.params.id, req.body);
    res.json(serializeResponse(usuario));
  }
);

export const updatePasswordUsuarioController = asyncHandler(
  async (req: Request, res: Response) => {
    const usuario = await updatePasswordUsuario(req.params.id, req.body);
    res.json(serializeResponse(usuario));
  }
);

export const deleteUsuarioController = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await deactivateUsuario(req.params.id);
  res.json(serializeResponse(usuario));
});
