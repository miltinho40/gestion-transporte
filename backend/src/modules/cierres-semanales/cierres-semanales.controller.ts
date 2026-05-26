import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createGastoSemanal,
  deleteGastoSemanal,
  generarGastosCierreSemanal,
  getCierreSemanal,
  listGastosSemanales,
  updateGastoSemanal
} from './cierres-semanales.service.js';

export const getCierreSemanalController = asyncHandler(async (req: Request, res: Response) => {
  const cierre = await getCierreSemanal(req.user!.propietario_id, req.query);
  res.json(serializeResponse(cierre));
});

export const generarGastosCierreSemanalController = asyncHandler(
  async (req: Request, res: Response) => {
    const cierre = await generarGastosCierreSemanal(req.user!.propietario_id, req.body);
    res.status(201).json(serializeResponse(cierre));
  }
);

export const listGastosSemanalesController = asyncHandler(async (req: Request, res: Response) => {
  const gastos = await listGastosSemanales(req.user!.propietario_id, req.query);
  res.json(serializeResponse(gastos));
});

export const createGastoSemanalController = asyncHandler(async (req: Request, res: Response) => {
  const gasto = await createGastoSemanal(req.user!.propietario_id, req.body);
  res.status(201).json(serializeResponse(gasto));
});

export const updateGastoSemanalController = asyncHandler(async (req: Request, res: Response) => {
  const gasto = await updateGastoSemanal(req.user!.propietario_id, req.params.id, req.body);
  res.json(serializeResponse(gasto));
});

export const deleteGastoSemanalController = asyncHandler(async (req: Request, res: Response) => {
  const gasto = await deleteGastoSemanal(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(gasto));
});
