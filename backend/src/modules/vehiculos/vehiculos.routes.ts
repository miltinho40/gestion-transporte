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

vehiculosRouter.use(
  authMiddleware,
  requirePropietarioContextOrSuperAdmin,
  requirePropietarioOperativo
);

vehiculosRouter.get('/', canReadVehiculos, listVehiculosController);
vehiculosRouter.post(
  '/',
  canWriteVehiculos,
  forbidSuperAdminWrite,
  validateBody(vehiculoCreateSchema),
  createVehiculoController
);
vehiculosRouter.get('/:id', canReadVehiculos, getVehiculoController);
vehiculosRouter.put(
  '/:id',
  canWriteVehiculos,
  forbidSuperAdminWrite,
  validateBody(vehiculoUpdateSchema),
  updateVehiculoController
);
vehiculosRouter.patch(
  '/:id/estado',
  canWriteVehiculos,
  forbidSuperAdminWrite,
  validateBody(vehiculoEstadoSchema),
  updateEstadoVehiculoController
);
vehiculosRouter.delete('/:id', canWriteVehiculos, forbidSuperAdminWrite, deleteVehiculoController);
