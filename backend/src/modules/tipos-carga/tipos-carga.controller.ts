import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createTipoCarga,
  deactivateTipoCarga,
  getTipoCargaById,
  listTiposCarga,
  updateEstadoTipoCarga,
  updateTipoCarga
} from './tipos-carga.service.js';

export const listTiposCargaController = asyncHandler(async (req: Request, res: Response) => {
  const tipos = await listTiposCarga(req.user, req.query);
  res.json(serializeResponse(tipos));
});

export const getTipoCargaController = asyncHandler(async (req: Request, res: Response) => {
  const tipo = await getTipoCargaById(req.user, req.params.id);
  res.json(serializeResponse(tipo));
});

export const createTipoCargaController = asyncHandler(async (req: Request, res: Response) => {
  const tipo = await createTipoCarga(req.user, req.body);
  res.status(201).json(serializeResponse(tipo));
});

export const updateTipoCargaController = asyncHandler(async (req: Request, res: Response) => {
  const tipo = await updateTipoCarga(req.user, req.params.id, req.body);
  res.json(serializeResponse(tipo));
});

export const updateEstadoTipoCargaController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipo = await updateEstadoTipoCarga(req.user, req.params.id, req.body);
    res.json(serializeResponse(tipo));
  }
);

export const deleteTipoCargaController = asyncHandler(async (req: Request, res: Response) => {
  const tipo = await deactivateTipoCarga(req.user, req.params.id);
  res.json(serializeResponse(tipo));
});
