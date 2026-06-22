import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import {
  listConfiguracionesPropietario,
  listConfiguracionesSuperAdmin,
  updateConfiguracionPropietario,
  updateConfiguracionSuperAdmin
} from './configuraciones.service.js';

export const listConfiguracionesPropietarioController = asyncHandler(
  async (req: Request, res: Response) => {
    const configuraciones = await listConfiguracionesPropietario(req.user!.propietario_id);
    res.json(serializeResponse(configuraciones));
  }
);

export const updateConfiguracionPropietarioController = asyncHandler(
  async (req: Request, res: Response) => {
    const configuracion = await updateConfiguracionPropietario(
      req.user!.propietario_id,
      req.params.clave,
      req.body
    );
    res.json(serializeResponse(configuracion));
  }
);

export const listConfiguracionesSuperAdminController = asyncHandler(
  async (_req: Request, res: Response) => {
    const configuraciones = await listConfiguracionesSuperAdmin();
    res.json(serializeResponse(configuraciones));
  }
);

export const updateConfiguracionSuperAdminController = asyncHandler(
  async (req: Request, res: Response) => {
    const configuracion = await updateConfiguracionSuperAdmin(req.params.clave, req.body);
    res.json(serializeResponse(configuracion));
  }
);
