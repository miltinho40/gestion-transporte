import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createTipoGastoViajeController,
  deleteTipoGastoViajeController,
  getTipoGastoViajeController,
  listTiposGastoViajeController,
  updateEstadoTipoGastoViajeController,
  updateTipoGastoViajeController
} from './tipos-gasto-viaje.controller.js';
import {
  tipoGastoViajeCreateSchema,
  tipoGastoViajeEstadoSchema,
  tipoGastoViajeUpdateSchema
} from './tipos-gasto-viaje.schema.js';

export const tiposGastoViajeRouter = Router();

tiposGastoViajeRouter.use(authMiddleware);

tiposGastoViajeRouter.get('/', listTiposGastoViajeController);
tiposGastoViajeRouter.get('/:id', getTipoGastoViajeController);
tiposGastoViajeRouter.post(
  '/',
  requireSuperAdmin,
  validateBody(tipoGastoViajeCreateSchema),
  createTipoGastoViajeController
);
tiposGastoViajeRouter.put(
  '/:id',
  requireSuperAdmin,
  validateBody(tipoGastoViajeUpdateSchema),
  updateTipoGastoViajeController
);
tiposGastoViajeRouter.patch(
  '/:id/estado',
  requireSuperAdmin,
  validateBody(tipoGastoViajeEstadoSchema),
  updateEstadoTipoGastoViajeController
);
tiposGastoViajeRouter.delete('/:id', requireSuperAdmin, deleteTipoGastoViajeController);
