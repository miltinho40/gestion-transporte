import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createPeaje,
  deactivatePeaje,
  getPeajeById,
  listPeajes,
  updateEstadoPeaje,
  updatePeaje
} from './peajes.service.js';

export const listPeajesController = asyncHandler(async (req: Request, res: Response) => {
  const peajes = await listPeajes(req.user, req.query);
  res.json(serializeResponse(peajes));
});

export const getPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const peaje = await getPeajeById(req.user, req.params.id);
  res.json(serializeResponse(peaje));
});

export const createPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const peaje = await createPeaje(req.user, req.body);
  res.status(201).json(serializeResponse(peaje));
});

export const updatePeajeController = asyncHandler(async (req: Request, res: Response) => {
  const peaje = await updatePeaje(req.user, req.params.id, req.body);
  res.json(serializeResponse(peaje));
});

export const updateEstadoPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const peaje = await updateEstadoPeaje(req.user, req.params.id, req.body);
  res.json(serializeResponse(peaje));
});

export const deletePeajeController = asyncHandler(async (req: Request, res: Response) => {
  const peaje = await deactivatePeaje(req.user, req.params.id);
  res.json(serializeResponse(peaje));
});
