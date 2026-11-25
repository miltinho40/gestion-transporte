import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { auditContextFromRequest } from '../../utils/audit.js';
import { serializeResponse } from '../../utils/response.js';
import { mapPaginatedResult } from '../../utils/pagination.js';
import { formatTarifaRuta } from './ruta-tarifa.js';
import {
  createTarifaRuta,
  deactivateTarifaRuta,
  getTarifaRutaById,
  listTarifasRuta,
  updateEstadoTarifaRuta,
  updateTarifaRuta
} from './tarifas-ruta.service.js';

export const listTarifasRutaController = asyncHandler(async (req: Request, res: Response) => {
  const tarifas = await listTarifasRuta(req.user, req.query);
  res.json(serializeResponse(mapPaginatedResult(tarifas, rows => rows.map(formatTarifaRuta))));
});

export const getTarifaRutaController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await getTarifaRutaById(req.user, req.params.id);
  res.json(serializeResponse(formatTarifaRuta(tarifa)));
});

export const createTarifaRutaController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await createTarifaRuta(
    req.user!.propietario_id,
    req.body,
    auditContextFromRequest(req)
  );
  res.status(201).json(serializeResponse(formatTarifaRuta(tarifa)));
});

export const updateTarifaRutaController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await updateTarifaRuta(
    req.user!.propietario_id,
    req.params.id,
    req.body,
    auditContextFromRequest(req)
  );
  res.json(serializeResponse(formatTarifaRuta(tarifa)));
});

export const updateEstadoTarifaRutaController = asyncHandler(
  async (req: Request, res: Response) => {
    const tarifa = await updateEstadoTarifaRuta(
      req.user!.propietario_id,
      req.params.id,
      req.body,
      auditContextFromRequest(req)
    );
    res.json(serializeResponse(formatTarifaRuta(tarifa)));
  }
);

export const deleteTarifaRutaController = asyncHandler(async (req: Request, res: Response) => {
  const tarifa = await deactivateTarifaRuta(
    req.user!.propietario_id,
    req.params.id,
    auditContextFromRequest(req)
  );
  res.json(serializeResponse(formatTarifaRuta(tarifa)));
});
