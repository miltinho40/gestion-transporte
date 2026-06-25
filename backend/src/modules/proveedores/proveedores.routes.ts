import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import {
  requireIntermediario,
  requirePropietarioContext,
  requireRoles
} from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createProveedorController,
  deleteProveedorController,
  getProveedorController,
  listProveedoresController,
  updateEstadoProveedorController,
  updateProveedorController
} from './proveedores.controller.js';
import {
  proveedorCreateSchema,
  proveedorEstadoSchema,
  proveedorUpdateSchema
} from './proveedores.schema.js';

export const proveedoresRouter = Router();

const canReadProveedores = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWriteProveedores = requireRoles('admin', 'operador');

proveedoresRouter.use(authMiddleware, requirePropietarioContext, requireIntermediario);

proveedoresRouter.get('/', canReadProveedores, listProveedoresController);
proveedoresRouter.post(
  '/',
  canWriteProveedores,
  validateBody(proveedorCreateSchema),
  createProveedorController
);
proveedoresRouter.get('/:id', canReadProveedores, getProveedorController);
proveedoresRouter.put(
  '/:id',
  canWriteProveedores,
  validateBody(proveedorUpdateSchema),
  updateProveedorController
);
proveedoresRouter.patch(
  '/:id/estado',
  canWriteProveedores,
  validateBody(proveedorEstadoSchema),
  updateEstadoProveedorController
);
proveedoresRouter.delete('/:id', canWriteProveedores, deleteProveedorController);
