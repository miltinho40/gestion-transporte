import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import { formatVehiculo, formatVehiculos } from './vehiculos.mapper.js';
import {
  createVehiculo,
  deactivateVehiculo,
  getVehiculoById,
  listVehiculos,
  updateEstadoVehiculo,
  updateVehiculo
} from './vehiculos.service.js';

export const listVehiculosController = asyncHandler(async (req: Request, res: Response) => {
  const vehiculos = await listVehiculos(req.user!.propietario_id, req.query);
  res.json(serializeResponse(formatVehiculos(vehiculos)));
});

export const getVehiculoController = asyncHandler(async (req: Request, res: Response) => {
  const vehiculo = await getVehiculoById(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(formatVehiculo(vehiculo)));
});

export const createVehiculoController = asyncHandler(async (req: Request, res: Response) => {
  const vehiculo = await createVehiculo(req.user!.propietario_id, req.body);
  res.status(201).json(serializeResponse(formatVehiculo(vehiculo)));
});

export const updateVehiculoController = asyncHandler(async (req: Request, res: Response) => {
  const vehiculo = await updateVehiculo(req.user!.propietario_id, req.params.id, req.body);
  res.json(serializeResponse(formatVehiculo(vehiculo)));
});

export const updateEstadoVehiculoController = asyncHandler(
  async (req: Request, res: Response) => {
    const vehiculo = await updateEstadoVehiculo(
      req.user!.propietario_id,
      req.params.id,
      req.body
    );
    res.json(serializeResponse(formatVehiculo(vehiculo)));
  }
);

export const deleteVehiculoController = asyncHandler(async (req: Request, res: Response) => {
  const vehiculo = await deactivateVehiculo(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(formatVehiculo(vehiculo)));
});
