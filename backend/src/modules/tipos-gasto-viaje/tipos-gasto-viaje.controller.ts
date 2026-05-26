import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createTipoGastoViaje,
  deactivateTipoGastoViaje,
  getTipoGastoViajeById,
  listTiposGastoViaje,
  updateEstadoTipoGastoViaje,
  updateTipoGastoViaje
} from './tipos-gasto-viaje.service.js';

export const listTiposGastoViajeController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipos = await listTiposGastoViaje(req.query);
    res.json(serializeResponse(tipos));
  }
);

export const getTipoGastoViajeController = asyncHandler(async (req: Request, res: Response) => {
  const tipo = await getTipoGastoViajeById(req.params.id);
  res.json(serializeResponse(tipo));
});

export const createTipoGastoViajeController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipo = await createTipoGastoViaje(req.body);
    res.status(201).json(serializeResponse(tipo));
  }
);

export const updateTipoGastoViajeController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipo = await updateTipoGastoViaje(req.params.id, req.body);
    res.json(serializeResponse(tipo));
  }
);

export const updateEstadoTipoGastoViajeController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipo = await updateEstadoTipoGastoViaje(req.params.id, req.body);
    res.json(serializeResponse(tipo));
  }
);

export const deleteTipoGastoViajeController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipo = await deactivateTipoGastoViaje(req.params.id);
    res.json(serializeResponse(tipo));
  }
);
