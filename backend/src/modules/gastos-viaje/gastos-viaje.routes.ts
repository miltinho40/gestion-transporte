import { Router } from 'express';
import { requireRoles } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createGastoViajeController,
  deleteGastoViajeController,
  getGastoViajeController,
  listGastosViajeController,
  updateGastoViajeController
} from './gastos-viaje.controller.js';
import { gastoViajeCreateSchema, gastoViajeUpdateSchema } from './gastos-viaje.schema.js';

export const gastosViajeRouter = Router({ mergeParams: true });

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWrite = requireRoles('admin', 'operador');

gastosViajeRouter.get('/', canRead, listGastosViajeController);
gastosViajeRouter.post(
  '/',
  canWrite,
  validateBody(gastoViajeCreateSchema),
  createGastoViajeController
);
gastosViajeRouter.get('/:id', canRead, getGastoViajeController);
gastosViajeRouter.put(
  '/:id',
  canWrite,
  validateBody(gastoViajeUpdateSchema),
  updateGastoViajeController
);
gastosViajeRouter.delete('/:id', canWrite, deleteGastoViajeController);
