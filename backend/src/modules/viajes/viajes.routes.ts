import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { gastosViajeRouter } from '../gastos-viaje/gastos-viaje.routes.js';
import {
  createViajeController,
  calculateViajeController,
  deleteViajeController,
  getViajeController,
  listViajesController,
  updateCobroViajeController,
  updateEstadoViajeController,
  updateViajeController
} from './viajes.controller.js';
import {
  viajeCobroSchema,
  viajeCreateSchema,
  viajeEstadoSchema,
  viajeUpdateSchema
} from './viajes.schema.js';

export const viajesRouter = Router();

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWrite = requireRoles('admin', 'operador');

viajesRouter.use(authMiddleware, requirePropietarioContext);

viajesRouter.get('/', canRead, listViajesController);
viajesRouter.post('/', canWrite, validateBody(viajeCreateSchema), createViajeController);
viajesRouter.get('/calculo', canRead, calculateViajeController);
viajesRouter.use('/:viajeId/gastos', gastosViajeRouter);
viajesRouter.get('/:id', canRead, getViajeController);
viajesRouter.put('/:id', canWrite, validateBody(viajeUpdateSchema), updateViajeController);
viajesRouter.patch(
  '/:id/estado',
  canWrite,
  validateBody(viajeEstadoSchema),
  updateEstadoViajeController
);
viajesRouter.patch(
  '/:id/cobro',
  canWrite,
  validateBody(viajeCobroSchema),
  updateCobroViajeController
);
viajesRouter.delete('/:id', canWrite, deleteViajeController);
