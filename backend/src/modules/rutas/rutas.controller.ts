import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createRuta,
  deactivateRuta,
  getRutaById,
  listRutas,
  updateEstadoRuta,
  updateRuta
} from './rutas.service.js';

export const listRutasController = asyncHandler(async (req: Request, res: Response) => {
  const rutas = await listRutas(req.user, req.query);
  res.json(serializeResponse(rutas));
});

export const getRutaController = asyncHandler(async (req: Request, res: Response) => {
  const ruta = await getRutaById(req.user, req.params.id);
  res.json(serializeResponse(ruta));
});

export const createRutaController = asyncHandler(async (req: Request, res: Response) => {
  const ruta = await createRuta(req.user, req.body);
  res.status(201).json(serializeResponse(ruta));
});

export const updateRutaController = asyncHandler(async (req: Request, res: Response) => {
  const ruta = await updateRuta(req.user, req.params.id, req.body);
  res.json(serializeResponse(ruta));
});

export const updateEstadoRutaController = asyncHandler(async (req: Request, res: Response) => {
  const ruta = await updateEstadoRuta(req.user, req.params.id, req.body);
  res.json(serializeResponse(ruta));
});

export const deleteRutaController = asyncHandler(async (req: Request, res: Response) => {
  const ruta = await deactivateRuta(req.user, req.params.id);
  res.json(serializeResponse(ruta));
});
