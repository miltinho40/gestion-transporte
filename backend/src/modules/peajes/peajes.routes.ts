import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles, requireSuperAdmin } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createPeajeController,
  deletePeajeController,
  getPeajeController,
  listPeajesController,
  updateEstadoPeajeController,
  updatePeajeController
} from './peajes.controller.js';
import { peajeCreateSchema, peajeEstadoSchema, peajeUpdateSchema } from './peajes.schema.js';

export const peajesRouter = Router();

const canManage = requireSuperAdmin;
const canReadCatalog = requireRoles('admin', 'operador', 'supervisor', 'consulta');

peajesRouter.use(authMiddleware);

peajesRouter.get('/', canManage, listPeajesController);
peajesRouter.post('/', canManage, validateBody(peajeCreateSchema), createPeajeController);
peajesRouter.get('/catalogo', canReadCatalog, listPeajesController);
peajesRouter.get('/:id', canManage, getPeajeController);
peajesRouter.put('/:id', canManage, validateBody(peajeUpdateSchema), updatePeajeController);
peajesRouter.patch(
  '/:id/estado',
  canManage,
  validateBody(peajeEstadoSchema),
  updateEstadoPeajeController
);
peajesRouter.delete('/:id', canManage, deletePeajeController);
