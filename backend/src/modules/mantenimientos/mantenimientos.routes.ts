import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createMantenimientoController,
  deleteMantenimientoController,
  getMantenimientoController,
  listMantenimientosController,
  updateEstadoMantenimientoController,
  updateMantenimientoController
} from './mantenimientos.controller.js';
import {
  mantenimientoCreateSchema,
  mantenimientoEstadoSchema,
  mantenimientoUpdateSchema
} from './mantenimientos.schema.js';

export const mantenimientosRouter = Router();

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWrite = requireRoles('admin', 'operador');

mantenimientosRouter.use(authMiddleware, requirePropietarioContext);

mantenimientosRouter.get('/', canRead, listMantenimientosController);
mantenimientosRouter.post(
  '/',
  canWrite,
  validateBody(mantenimientoCreateSchema),
  createMantenimientoController
);
mantenimientosRouter.get('/:id', canRead, getMantenimientoController);
mantenimientosRouter.put(
  '/:id',
  canWrite,
  validateBody(mantenimientoUpdateSchema),
  updateMantenimientoController
);
mantenimientosRouter.patch(
  '/:id/estado',
  canWrite,
  validateBody(mantenimientoEstadoSchema),
  updateEstadoMantenimientoController
);
mantenimientosRouter.delete('/:id', canWrite, deleteMantenimientoController);
