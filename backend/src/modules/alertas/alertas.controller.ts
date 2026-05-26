import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  listAlertas,
  listAlertasLicencias,
  listAlertasMantenimientos,
  listAlertasViajesSinCobrar
} from './alertas.service.js';

export const listAlertasController = asyncHandler(async (req: Request, res: Response) => {
  const alertas = await listAlertas(req.user!.propietario_id);
  res.json(serializeResponse(alertas));
});

export const listAlertasMantenimientosController = asyncHandler(
  async (req: Request, res: Response) => {
    const alertas = await listAlertasMantenimientos(req.user!.propietario_id);
    res.json(serializeResponse(alertas));
  }
);

export const listAlertasLicenciasController = asyncHandler(
  async (req: Request, res: Response) => {
    const alertas = await listAlertasLicencias(req.user!.propietario_id);
    res.json(serializeResponse(alertas));
  }
);

export const listAlertasViajesSinCobrarController = asyncHandler(
  async (req: Request, res: Response) => {
    const alertas = await listAlertasViajesSinCobrar(req.user!.propietario_id);
    res.json(serializeResponse(alertas));
  }
);
