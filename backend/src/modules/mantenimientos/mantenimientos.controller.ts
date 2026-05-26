import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import { formatMantenimiento, formatMantenimientos } from './mantenimientos.mapper.js';
import {
  cancelMantenimiento,
  createMantenimiento,
  getMantenimientoById,
  listMantenimientos,
  updateEstadoMantenimiento,
  updateMantenimiento
} from './mantenimientos.service.js';

export const listMantenimientosController = asyncHandler(async (req: Request, res: Response) => {
  const mantenimientos = await listMantenimientos(req.user!.propietario_id, req.query);
  res.json(serializeResponse(formatMantenimientos(mantenimientos)));
});

export const getMantenimientoController = asyncHandler(async (req: Request, res: Response) => {
  const mantenimiento = await getMantenimientoById(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(formatMantenimiento(mantenimiento)));
});

export const createMantenimientoController = asyncHandler(
  async (req: Request, res: Response) => {
    const mantenimiento = await createMantenimiento(req.user!.propietario_id, req.body);
    res.status(201).json(serializeResponse(formatMantenimiento(mantenimiento)));
  }
);

export const updateMantenimientoController = asyncHandler(
  async (req: Request, res: Response) => {
    const mantenimiento = await updateMantenimiento(
      req.user!.propietario_id,
      req.params.id,
      req.body
    );
    res.json(serializeResponse(formatMantenimiento(mantenimiento)));
  }
);

export const updateEstadoMantenimientoController = asyncHandler(
  async (req: Request, res: Response) => {
    const mantenimiento = await updateEstadoMantenimiento(
      req.user!.propietario_id,
      req.params.id,
      req.body
    );
    res.json(serializeResponse(formatMantenimiento(mantenimiento)));
  }
);

export const deleteMantenimientoController = asyncHandler(
  async (req: Request, res: Response) => {
    const mantenimiento = await cancelMantenimiento(req.user!.propietario_id, req.params.id);
    res.json(serializeResponse(formatMantenimiento(mantenimiento)));
  }
);
