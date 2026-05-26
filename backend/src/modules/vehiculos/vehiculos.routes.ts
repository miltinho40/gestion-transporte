import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createVehiculoController,
  deleteVehiculoController,
  getVehiculoController,
  listVehiculosController,
  updateEstadoVehiculoController,
  updateVehiculoController
} from './vehiculos.controller.js';
import {
  vehiculoCreateSchema,
  vehiculoEstadoSchema,
  vehiculoUpdateSchema
} from './vehiculos.schema.js';

export const vehiculosRouter = Router();

const canReadVehiculos = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWriteVehiculos = requireRoles('admin', 'operador');

vehiculosRouter.use(authMiddleware, requirePropietarioContext);

vehiculosRouter.get('/', canReadVehiculos, listVehiculosController);
vehiculosRouter.post(
  '/',
  canWriteVehiculos,
  validateBody(vehiculoCreateSchema),
  createVehiculoController
);
vehiculosRouter.get('/:id', canReadVehiculos, getVehiculoController);
vehiculosRouter.put(
  '/:id',
  canWriteVehiculos,
  validateBody(vehiculoUpdateSchema),
  updateVehiculoController
);
vehiculosRouter.patch(
  '/:id/estado',
  canWriteVehiculos,
  validateBody(vehiculoEstadoSchema),
  updateEstadoVehiculoController
);
vehiculosRouter.delete('/:id', canWriteVehiculos, deleteVehiculoController);
