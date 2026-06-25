import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { auditContextFromRequest } from '../../utils/audit.js';
import { mapPaginatedResult } from '../../utils/pagination.js';
import { serializeResponse } from '../../utils/response.js';
import { formatViajeProveedor, formatViajesProveedor } from './viajes-proveedor.mapper.js';
import {
  addGuiasViajeProveedor,
  cancelViajeProveedor,
  createViajeProveedor,
  getResumenViajesProveedor,
  getViajeProveedorById,
  listViajesProveedor,
  updateCobroViajeProveedor,
  updateEstadoViajeProveedor,
  updatePagoViajeProveedor,
  updateViajeProveedor
} from './viajes-proveedor.service.js';

export const listViajesProveedorController = asyncHandler(async (req: Request, res: Response) => {
  const viajes = await listViajesProveedor(req.user!.propietario_id, req.query);
  res.json(serializeResponse(mapPaginatedResult(viajes, formatViajesProveedor)));
});

export const getResumenViajesProveedorController = asyncHandler(async (req: Request, res: Response) => {
  const resumen = await getResumenViajesProveedor(req.user!.propietario_id, req.query);
  res.json(serializeResponse(resumen));
});

export const getViajeProveedorController = asyncHandler(async (req: Request, res: Response) => {
  const viaje = await getViajeProveedorById(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(formatViajeProveedor(viaje)));
});

export const createViajeProveedorController = asyncHandler(
  async (req: Request, res: Response) => {
    const viaje = await createViajeProveedor(
      req.user!.propietario_id,
      req.body,
      auditContextFromRequest(req)
    );
    res.status(201).json(serializeResponse(formatViajeProveedor(viaje)));
  }
);

export const updateViajeProveedorController = asyncHandler(
  async (req: Request, res: Response) => {
    const viaje = await updateViajeProveedor(
      req.user!.propietario_id,
      req.params.id,
      req.body,
      auditContextFromRequest(req)
    );
    res.json(serializeResponse(formatViajeProveedor(viaje)));
  }
);

export const updateEstadoViajeProveedorController = asyncHandler(
  async (req: Request, res: Response) => {
    const viaje = await updateEstadoViajeProveedor(
      req.user!.propietario_id,
      req.params.id,
      req.body,
      auditContextFromRequest(req)
    );
    res.json(serializeResponse(formatViajeProveedor(viaje)));
  }
);

export const updateCobroViajeProveedorController = asyncHandler(
  async (req: Request, res: Response) => {
    const viaje = await updateCobroViajeProveedor(
      req.user!.propietario_id,
      req.params.id,
      req.body,
      auditContextFromRequest(req)
    );
    res.json(serializeResponse(formatViajeProveedor(viaje)));
  }
);

export const updatePagoViajeProveedorController = asyncHandler(
  async (req: Request, res: Response) => {
    const viaje = await updatePagoViajeProveedor(
      req.user!.propietario_id,
      req.params.id,
      req.body,
      auditContextFromRequest(req)
    );
    res.json(serializeResponse(formatViajeProveedor(viaje)));
  }
);

export const addGuiasViajeProveedorController = asyncHandler(
  async (req: Request, res: Response) => {
    const viaje = await addGuiasViajeProveedor(
      req.user!.propietario_id,
      req.params.id,
      req.body,
      auditContextFromRequest(req)
    );
    res.json(serializeResponse(formatViajeProveedor(viaje)));
  }
);

export const deleteViajeProveedorController = asyncHandler(async (req: Request, res: Response) => {
  const viaje = await cancelViajeProveedor(
    req.user!.propietario_id,
    req.params.id,
    auditContextFromRequest(req)
  );
  res.json(serializeResponse(formatViajeProveedor(viaje)));
});
