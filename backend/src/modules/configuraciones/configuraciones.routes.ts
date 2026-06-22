import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import {
  requirePropietarioContext,
  requireRoles,
  requireSuperAdmin
} from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  listConfiguracionesPropietarioController,
  listConfiguracionesSuperAdminController,
  updateConfiguracionPropietarioController,
  updateConfiguracionSuperAdminController
} from './configuraciones.controller.js';
import { configuracionUpdateSchema } from './configuraciones.schema.js';

export const configuracionesRouter = Router();

configuracionesRouter.use(authMiddleware);

configuracionesRouter.get('/superadmin', requireSuperAdmin, listConfiguracionesSuperAdminController);
configuracionesRouter.put(
  '/superadmin/:clave',
  requireSuperAdmin,
  validateBody(configuracionUpdateSchema),
  updateConfiguracionSuperAdminController
);

configuracionesRouter.get(
  '/',
  requirePropietarioContext,
  requireRoles('admin'),
  listConfiguracionesPropietarioController
);
configuracionesRouter.put(
  '/:clave',
  requirePropietarioContext,
  requireRoles('admin'),
  validateBody(configuracionUpdateSchema),
  updateConfiguracionPropietarioController
);
