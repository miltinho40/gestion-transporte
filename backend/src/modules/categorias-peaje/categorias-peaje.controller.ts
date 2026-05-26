import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createCategoriaPeaje,
  deactivateCategoriaPeaje,
  getCategoriaPeajeById,
  listCategoriasPeaje,
  updateCategoriaPeaje,
  updateEstadoCategoriaPeaje
} from './categorias-peaje.service.js';

export const listCategoriasPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const categorias = await listCategoriasPeaje(req.user, req.query);
  res.json(serializeResponse(categorias));
});

export const getCategoriaPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const categoria = await getCategoriaPeajeById(req.user, req.params.id);
  res.json(serializeResponse(categoria));
});

export const createCategoriaPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const categoria = await createCategoriaPeaje(req.user, req.body);
  res.status(201).json(serializeResponse(categoria));
});

export const updateCategoriaPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const categoria = await updateCategoriaPeaje(req.user, req.params.id, req.body);
  res.json(serializeResponse(categoria));
});

export const updateEstadoCategoriaPeajeController = asyncHandler(
  async (req: Request, res: Response) => {
    const categoria = await updateEstadoCategoriaPeaje(req.user, req.params.id, req.body);
    res.json(serializeResponse(categoria));
  }
);

export const deleteCategoriaPeajeController = asyncHandler(
  async (req: Request, res: Response) => {
    const categoria = await deactivateCategoriaPeaje(req.user, req.params.id);
    res.json(serializeResponse(categoria));
  }
);
