import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import {
  forbidSuperAdminWrite,
  requirePropietarioContextOrSuperAdmin,
  requirePropietarioOperativo,
  requireRoles
} from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createConductorController,
  deleteConductorController,
  getConductorController,
  listConductoresController,
  updateConductorController,
  updateEstadoConductorController
} from './conductores.controller.js';
import {
  conductorCreateSchema,
  conductorEstadoSchema,
  conductorUpdateSchema
} from './conductores.schema.js';

export const conductoresRouter = Router();

const canReadConductores = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWriteConductores = requireRoles('admin', 'operador');

conductoresRouter.use(
  authMiddleware,
  requirePropietarioContextOrSuperAdmin,
  requirePropietarioOperativo
);

conductoresRouter.get('/', canReadConductores, listConductoresController);
conductoresRouter.post(
  '/',
  canWriteConductores,
  forbidSuperAdminWrite,
  validateBody(conductorCreateSchema),
  createConductorController
);
conductoresRouter.get('/:id', canReadConductores, getConductorController);
conductoresRouter.put(
  '/:id',
  canWriteConductores,
  forbidSuperAdminWrite,
  validateBody(conductorUpdateSchema),
  updateConductorController
);
conductoresRouter.patch(
  '/:id/estado',
  canWriteConductores,
  forbidSuperAdminWrite,
  validateBody(conductorEstadoSchema),
  updateEstadoConductorController
);
conductoresRouter.delete('/:id', canWriteConductores, forbidSuperAdminWrite, deleteConductorController);
