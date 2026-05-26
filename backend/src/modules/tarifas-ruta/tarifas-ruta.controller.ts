import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createTarifaRuta,
  deactivateTarifaRuta,
  getTarifaRutaById,
  listTarifasRuta,
  updateEstadoTarifaRuta,
  updateTarifaRuta
} from './tarifas-ruta.service.js';

export const listTarifasRutaController = asyncHandler(async (req: Request, res: Response) => {
  const tarifas = await listTarifasRuta(req.user!.propietario_id, req.query);
  res.json(serializeResponse(tarifas));
});

export const getTarifaRutaController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await getTarifaRutaById(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(tarifa));
});

export const createTarifaRutaController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await createTarifaRuta(req.user!.propietario_id, req.body);
  res.status(201).json(serializeResponse(tarifa));
});

export const updateTarifaRutaController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await updateTarifaRuta(req.user!.propietario_id, req.params.id, req.body);
  res.json(serializeResponse(tarifa));
});

export const updateEstadoTarifaRutaController = asyncHandler(
  async (req: Request, res: Response) => {
    const tarifa = await updateEstadoTarifaRuta(
      req.user!.propietario_id,
      req.params.id,
      req.body
    );
    res.json(serializeResponse(tarifa));
  }
);

export const deleteTarifaRutaController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await deactivateTarifaRuta(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(tarifa));
});
