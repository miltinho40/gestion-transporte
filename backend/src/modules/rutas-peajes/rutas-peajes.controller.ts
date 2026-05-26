import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import { formatRutaPeaje, formatRutasPeajes } from './rutas-peajes.mapper.js';
import {
  createRutaPeaje,
  deleteRutaPeaje,
  getRutaPeajeById,
  listRutasPeajes,
  updateRutaPeaje
} from './rutas-peajes.service.js';

export const listRutasPeajesController = asyncHandler(async (req: Request, res: Response) => {
  const items = await listRutasPeajes(req.user, req.query);
  res.json(serializeResponse(formatRutasPeajes(items)));
});

export const getRutaPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const item = await getRutaPeajeById(req.user, req.params.id);
  res.json(serializeResponse(formatRutaPeaje(item)));
});

export const createRutaPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const item = await createRutaPeaje(req.user, req.body);
  res.status(201).json(serializeResponse(formatRutaPeaje(item)));
});

export const updateRutaPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const item = await updateRutaPeaje(req.user, req.params.id, req.body);
  res.json(serializeResponse(formatRutaPeaje(item)));
});

export const deleteRutaPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const item = await deleteRutaPeaje(req.user, req.params.id);
  res.json(serializeResponse(formatRutaPeaje(item)));
});
