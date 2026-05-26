import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import { formatConductor, formatConductores } from './conductores.mapper.js';
import {
  createConductor,
  deactivateConductor,
  getConductorById,
  listConductores,
  updateConductor,
  updateEstadoConductor
} from './conductores.service.js';

export const listConductoresController = asyncHandler(async (req: Request, res: Response) => {
  const conductores = await listConductores(req.user!.propietario_id, req.query);
  res.json(serializeResponse(formatConductores(conductores)));
});

export const getConductorController = asyncHandler(async (req: Request, res: Response) => {
  const conductor = await getConductorById(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(formatConductor(conductor)));
});

export const createConductorController = asyncHandler(async (req: Request, res: Response) => {
  const conductor = await createConductor(req.user!.propietario_id, req.body);
  res.status(201).json(serializeResponse(formatConductor(conductor)));
});

export const updateConductorController = asyncHandler(async (req: Request, res: Response) => {
  const conductor = await updateConductor(req.user!.propietario_id, req.params.id, req.body);
  res.json(serializeResponse(formatConductor(conductor)));
});

export const updateEstadoConductorController = asyncHandler(
  async (req: Request, res: Response) => {
    const conductor = await updateEstadoConductor(
      req.user!.propietario_id,
      req.params.id,
      req.body
    );
    res.json(serializeResponse(formatConductor(conductor)));
  }
);

export const deleteConductorController = asyncHandler(async (req: Request, res: Response) => {
  const conductor = await deactivateConductor(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(formatConductor(conductor)));
});
