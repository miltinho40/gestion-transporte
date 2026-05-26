import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
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

conductoresRouter.use(authMiddleware, requirePropietarioContext);

conductoresRouter.get('/', canReadConductores, listConductoresController);
conductoresRouter.post(
  '/',
  canWriteConductores,
  validateBody(conductorCreateSchema),
  createConductorController
);
conductoresRouter.get('/:id', canReadConductores, getConductorController);
conductoresRouter.put(
  '/:id',
  canWriteConductores,
  validateBody(conductorUpdateSchema),
  updateConductorController
);
conductoresRouter.patch(
  '/:id/estado',
  canWriteConductores,
  validateBody(conductorEstadoSchema),
  updateEstadoConductorController
);
conductoresRouter.delete('/:id', canWriteConductores, deleteConductorController);
