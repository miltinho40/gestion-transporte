import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createGastoViaje,
  deleteGastoViaje,
  getGastoViajeById,
  listGastosViaje,
  updateGastoViaje
} from './gastos-viaje.service.js';

export const listGastosViajeController = asyncHandler(async (req: Request, res: Response) => {
  const gastos = await listGastosViaje(req.user!.propietario_id, req.params.viajeId, req.query);
  res.json(serializeResponse(gastos));
});

export const getGastoViajeController = asyncHandler(async (req: Request, res: Response) => {
  const gasto = await getGastoViajeById(
    req.user!.propietario_id,
    req.params.viajeId,
    req.params.id
  );
  res.json(serializeResponse(gasto));
});

export const createGastoViajeController = asyncHandler(async (req: Request, res: Response) => {
  const gasto = await createGastoViaje(req.user!.propietario_id, req.params.viajeId, req.body);
  res.status(201).json(serializeResponse(gasto));
});

export const updateGastoViajeController = asyncHandler(async (req: Request, res: Response) => {
  const gasto = await updateGastoViaje(
    req.user!.propietario_id,
    req.params.viajeId,
    req.params.id,
    req.body
  );
  res.json(serializeResponse(gasto));
});

export const deleteGastoViajeController = asyncHandler(async (req: Request, res: Response) => {
  const gasto = await deleteGastoViaje(
    req.user!.propietario_id,
    req.params.viajeId,
    req.params.id
  );
  res.json(serializeResponse(gasto));
});
