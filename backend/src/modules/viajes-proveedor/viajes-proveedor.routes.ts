import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import {
  requireIntermediario,
  requirePropietarioContext,
  requireRoles
} from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  addGuiasViajeProveedorController,
  createViajeProveedorController,
  deleteViajeProveedorController,
  getResumenViajesProveedorController,
  getViajeProveedorController,
  listViajesProveedorController,
  updateCobroViajeProveedorController,
  updateEstadoViajeProveedorController,
  updatePagoViajeProveedorController,
  updateViajeProveedorController
} from './viajes-proveedor.controller.js';
import {
  viajeProveedorCobroSchema,
  viajeProveedorCreateSchema,
  viajeProveedorEstadoSchema,
  viajeProveedorGuiasSchema,
  viajeProveedorPagoSchema,
  viajeProveedorUpdateSchema
} from './viajes-proveedor.schema.js';

export const viajesProveedorRouter = Router();

const canReadViajesProveedor = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWriteViajesProveedor = requireRoles('admin', 'operador');

viajesProveedorRouter.use(authMiddleware, requirePropietarioContext, requireIntermediario);

viajesProveedorRouter.get('/', canReadViajesProveedor, listViajesProveedorController);
viajesProveedorRouter.get('/resumen', canReadViajesProveedor, getResumenViajesProveedorController);
viajesProveedorRouter.post(
  '/',
  canWriteViajesProveedor,
  validateBody(viajeProveedorCreateSchema),
  createViajeProveedorController
);
viajesProveedorRouter.get('/:id', canReadViajesProveedor, getViajeProveedorController);
viajesProveedorRouter.put(
  '/:id',
  canWriteViajesProveedor,
  validateBody(viajeProveedorUpdateSchema),
  updateViajeProveedorController
);
viajesProveedorRouter.patch(
  '/:id/estado',
  canWriteViajesProveedor,
  validateBody(viajeProveedorEstadoSchema),
  updateEstadoViajeProveedorController
);
viajesProveedorRouter.patch(
  '/:id/cobro',
  canWriteViajesProveedor,
  validateBody(viajeProveedorCobroSchema),
  updateCobroViajeProveedorController
);
viajesProveedorRouter.patch(
  '/:id/pago',
  canWriteViajesProveedor,
  validateBody(viajeProveedorPagoSchema),
  updatePagoViajeProveedorController
);
viajesProveedorRouter.patch(
  '/:id/guias',
  canWriteViajesProveedor,
  validateBody(viajeProveedorGuiasSchema),
  addGuiasViajeProveedorController
);
viajesProveedorRouter.delete('/:id', canWriteViajesProveedor, deleteViajeProveedorController);
