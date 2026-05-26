import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import { formatViaje, formatViajes } from './viajes.mapper.js';
import {
  calculateViajeValores,
  cancelViaje,
  createViaje,
  getViajeById,
  listViajes,
  updateCobroViaje,
  updateEstadoViaje,
  updateViaje
} from './viajes.service.js';

export const listViajesController = asyncHandler(async (req: Request, res: Response) => {
  const viajes = await listViajes(req.user!.propietario_id, req.query);
  res.json(serializeResponse(formatViajes(viajes)));
});

export const getViajeController = asyncHandler(async (req: Request, res: Response) => {
  const viaje = await getViajeById(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(formatViaje(viaje)));
});

export const calculateViajeController = asyncHandler(async (req: Request, res: Response) => {
  const valores = await calculateViajeValores(req.user!.propietario_id, req.query);
  res.json(serializeResponse(valores));
});

export const createViajeController = asyncHandler(async (req: Request, res: Response) => {
  const viaje = await createViaje(req.user!.propietario_id, req.body);
  res.status(201).json(serializeResponse(formatViaje(viaje)));
});

export const updateViajeController = asyncHandler(async (req: Request, res: Response) => {
  const viaje = await updateViaje(req.user!.propietario_id, req.params.id, req.body);
  res.json(serializeResponse(formatViaje(viaje)));
});

export const updateEstadoViajeController = asyncHandler(
  async (req: Request, res: Response) => {
    const viaje = await updateEstadoViaje(req.user!.propietario_id, req.params.id, req.body);
    res.json(serializeResponse(formatViaje(viaje)));
  }
);

export const updateCobroViajeController = asyncHandler(async (req: Request, res: Response) => {
  const viaje = await updateCobroViaje(req.user!.propietario_id, req.params.id, req.body);
  res.json(serializeResponse(formatViaje(viaje)));
});

export const deleteViajeController = asyncHandler(async (req: Request, res: Response) => {
  const viaje = await cancelViaje(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(formatViaje(viaje)));
});
