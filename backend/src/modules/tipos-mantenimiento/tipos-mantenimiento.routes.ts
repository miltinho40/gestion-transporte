import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createTipoMantenimientoController,
  deleteTipoMantenimientoController,
  getTipoMantenimientoController,
  listTiposMantenimientoController,
  updateEstadoTipoMantenimientoController,
  updateTipoMantenimientoController
} from './tipos-mantenimiento.controller.js';
import {
  tipoMantenimientoCreateSchema,
  tipoMantenimientoEstadoSchema,
  tipoMantenimientoUpdateSchema
} from './tipos-mantenimiento.schema.js';

export const tiposMantenimientoRouter = Router();

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWrite = requireRoles('admin', 'operador');

tiposMantenimientoRouter.use(authMiddleware);

tiposMantenimientoRouter.get('/', canRead, listTiposMantenimientoController);
tiposMantenimientoRouter.post(
  '/',
  canWrite,
  validateBody(tipoMantenimientoCreateSchema),
  createTipoMantenimientoController
);
tiposMantenimientoRouter.get('/:id', canRead, getTipoMantenimientoController);
tiposMantenimientoRouter.put(
  '/:id',
  canWrite,
  validateBody(tipoMantenimientoUpdateSchema),
  updateTipoMantenimientoController
);
tiposMantenimientoRouter.patch(
  '/:id/estado',
  canWrite,
  validateBody(tipoMantenimientoEstadoSchema),
  updateEstadoTipoMantenimientoController
);
tiposMantenimientoRouter.delete('/:id', canWrite, deleteTipoMantenimientoController);
