import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createTarifaPeajeController,
  deleteTarifaPeajeController,
  getTarifaPeajeController,
  listTarifasPeajeController,
  updateEstadoTarifaPeajeController,
  updateTarifaPeajeController
} from './tarifas-peaje.controller.js';
import {
  tarifaPeajeCreateSchema,
  tarifaPeajeEstadoSchema,
  tarifaPeajeUpdateSchema
} from './tarifas-peaje.schema.js';

export const tarifasPeajeRouter = Router();

const canManage = requireSuperAdmin;

tarifasPeajeRouter.use(authMiddleware);

tarifasPeajeRouter.get('/', canManage, listTarifasPeajeController);
tarifasPeajeRouter.post(
  '/',
  canManage,
  validateBody(tarifaPeajeCreateSchema),
  createTarifaPeajeController
);
tarifasPeajeRouter.get('/:id', canManage, getTarifaPeajeController);
tarifasPeajeRouter.put(
  '/:id',
  canManage,
  validateBody(tarifaPeajeUpdateSchema),
  updateTarifaPeajeController
);
tarifasPeajeRouter.patch(
  '/:id/estado',
  canManage,
  validateBody(tarifaPeajeEstadoSchema),
  updateEstadoTarifaPeajeController
);
tarifasPeajeRouter.delete('/:id', canManage, deleteTarifaPeajeController);
