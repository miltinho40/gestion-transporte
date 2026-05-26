import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createTipoCargaController,
  deleteTipoCargaController,
  getTipoCargaController,
  listTiposCargaController,
  updateEstadoTipoCargaController,
  updateTipoCargaController
} from './tipos-carga.controller.js';
import {
  tipoCargaCreateSchema,
  tipoCargaEstadoSchema,
  tipoCargaUpdateSchema
} from './tipos-carga.schema.js';

export const tiposCargaRouter = Router();

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWrite = requireRoles('admin', 'operador');

tiposCargaRouter.use(authMiddleware);

tiposCargaRouter.get('/', canRead, listTiposCargaController);
tiposCargaRouter.get('/:id', canRead, getTipoCargaController);
tiposCargaRouter.post('/', canWrite, validateBody(tipoCargaCreateSchema), createTipoCargaController);
tiposCargaRouter.put('/:id', canWrite, validateBody(tipoCargaUpdateSchema), updateTipoCargaController);
tiposCargaRouter.patch(
  '/:id/estado',
  canWrite,
  validateBody(tipoCargaEstadoSchema),
  updateEstadoTipoCargaController
);
tiposCargaRouter.delete('/:id', canWrite, deleteTipoCargaController);
