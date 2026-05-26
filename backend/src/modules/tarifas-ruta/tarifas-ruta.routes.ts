import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createTarifaRutaController,
  deleteTarifaRutaController,
  getTarifaRutaController,
  listTarifasRutaController,
  updateEstadoTarifaRutaController,
  updateTarifaRutaController
} from './tarifas-ruta.controller.js';
import {
  tarifaRutaCreateSchema,
  tarifaRutaEstadoSchema,
  tarifaRutaUpdateSchema
} from './tarifas-ruta.schema.js';

export const tarifasRutaRouter = Router();

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWrite = requireRoles('admin', 'operador');

tarifasRutaRouter.use(authMiddleware, requirePropietarioContext);

tarifasRutaRouter.get('/', canRead, listTarifasRutaController);
tarifasRutaRouter.post(
  '/',
  canWrite,
  validateBody(tarifaRutaCreateSchema),
  createTarifaRutaController
);
tarifasRutaRouter.get('/:id', canRead, getTarifaRutaController);
tarifasRutaRouter.put(
  '/:id',
  canWrite,
  validateBody(tarifaRutaUpdateSchema),
  updateTarifaRutaController
);
tarifasRutaRouter.patch(
  '/:id/estado',
  canWrite,
  validateBody(tarifaRutaEstadoSchema),
  updateEstadoTarifaRutaController
);
tarifasRutaRouter.delete('/:id', canWrite, deleteTarifaRutaController);
