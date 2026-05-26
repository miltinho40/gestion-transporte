import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  createCliente,
  deactivateCliente,
  getClienteById,
  listClientes,
  updateCliente,
  updateEstadoCliente
} from './clientes.service.js';

export const listClientesController = asyncHandler(async (req: Request, res: Response) => {
  const clientes = await listClientes(req.user!.propietario_id, req.query);
  res.json(serializeResponse(clientes));
});

export const getClienteController = asyncHandler(async (req: Request, res: Response) => {
  const cliente = await getClienteById(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(cliente));
});

export const createClienteController = asyncHandler(async (req: Request, res: Response) => {
  const cliente = await createCliente(req.user!.propietario_id, req.body);
  res.status(201).json(serializeResponse(cliente));
});

export const updateClienteController = asyncHandler(async (req: Request, res: Response) => {
  const cliente = await updateCliente(req.user!.propietario_id, req.params.id, req.body);
  res.json(serializeResponse(cliente));
});

export const updateEstadoClienteController = asyncHandler(
  async (req: Request, res: Response) => {
    const cliente = await updateEstadoCliente(req.user!.propietario_id, req.params.id, req.body);
    res.json(serializeResponse(cliente));
  }
);

export const deleteClienteController = asyncHandler(async (req: Request, res: Response) => {
  const cliente = await deactivateCliente(req.user!.propietario_id, req.params.id);
  res.json(serializeResponse(cliente));
});
