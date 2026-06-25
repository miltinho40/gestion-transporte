import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createProveedor,
  deactivateProveedor,
  getProveedorById,
  listProveedores,
  updateEstadoProveedor,
  updateProveedor
} from './proveedores.service.js';

export const listProveedoresController = asyncHandler(async (req: Request, res: Response) => {
  const proveedores = await listProveedores(req.user!.propietario_id, req.query);
  res.json(serializeResponse(proveedores));
});

export const getProveedorController = asyncHandler(async (req: Request, res: Response) => {
  const proveedor = await getProveedorById(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(proveedor));
});

export const createProveedorController = asyncHandler(async (req: Request, res: Response) => {
  const proveedor = await createProveedor(req.user!.propietario_id, req.body);
  res.status(201).json(serializeResponse(proveedor));
});

export const updateProveedorController = asyncHandler(async (req: Request, res: Response) => {
  const proveedor = await updateProveedor(req.user!.propietario_id, req.params.id, req.body);
  res.json(serializeResponse(proveedor));
});

export const updateEstadoProveedorController = asyncHandler(
  async (req: Request, res: Response) => {
    const proveedor = await updateEstadoProveedor(req.user!.propietario_id, req.params.id, req.body);
    res.json(serializeResponse(proveedor));
  }
);

export const deleteProveedorController = asyncHandler(async (req: Request, res: Response) => {
  const proveedor = await deactivateProveedor(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(proveedor));
});
