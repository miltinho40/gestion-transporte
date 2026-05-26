import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createTipoMantenimiento,
  deactivateTipoMantenimiento,
  getTipoMantenimientoById,
  listTiposMantenimiento,
  updateEstadoTipoMantenimiento,
  updateTipoMantenimiento
} from './tipos-mantenimiento.service.js';

export const listTiposMantenimientoController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipos = await listTiposMantenimiento(req.user, req.query);
    res.json(serializeResponse(tipos));
  }
);

export const getTipoMantenimientoController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipo = await getTipoMantenimientoById(req.user, req.params.id);
    res.json(serializeResponse(tipo));
  }
);

export const createTipoMantenimientoController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipo = await createTipoMantenimiento(req.user, req.body);
    res.status(201).json(serializeResponse(tipo));
  }
);

export const updateTipoMantenimientoController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipo = await updateTipoMantenimiento(req.user, req.params.id, req.body);
    res.json(serializeResponse(tipo));
  }
);

export const updateEstadoTipoMantenimientoController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipo = await updateEstadoTipoMantenimiento(req.user, req.params.id, req.body);
    res.json(serializeResponse(tipo));
  }
);

export const deleteTipoMantenimientoController = asyncHandler(
  async (req: Request, res: Response) => {
    const tipo = await deactivateTipoMantenimiento(req.user, req.params.id);
    res.json(serializeResponse(tipo));
  }
);
