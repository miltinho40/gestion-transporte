import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createTarifaPeaje,
  deactivateTarifaPeaje,
  getTarifaPeajeById,
  listTarifasPeaje,
  updateEstadoTarifaPeaje,
  updateTarifaPeaje
} from './tarifas-peaje.service.js';

export const listTarifasPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const tarifas = await listTarifasPeaje(req.user, req.query);
  res.json(serializeResponse(tarifas));
});

export const getTarifaPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await getTarifaPeajeById(req.user, req.params.id);
  res.json(serializeResponse(tarifa));
});

export const createTarifaPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await createTarifaPeaje(req.user, req.body);
  res.status(201).json(serializeResponse(tarifa));
});

export const updateTarifaPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await updateTarifaPeaje(req.user, req.params.id, req.body);
  res.json(serializeResponse(tarifa));
});

export const updateEstadoTarifaPeajeController = asyncHandler(
  async (req: Request, res: Response) => {
    const tarifa = await updateEstadoTarifaPeaje(req.user, req.params.id, req.body);
    res.json(serializeResponse(tarifa));
  }
);

export const deleteTarifaPeajeController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await deactivateTarifaPeaje(req.user, req.params.id);
  res.json(serializeResponse(tarifa));
});
