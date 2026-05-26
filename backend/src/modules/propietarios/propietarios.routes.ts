import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createPropietarioController,
  deletePropietarioController,
  getPropietarioController,
  listPropietariosController,
  updateEstadoPropietarioController,
  updatePropietarioController
} from './propietarios.controller.js';
import {
  propietarioCreateSchema,
  propietarioEstadoSchema,
  propietarioUpdateSchema
} from './propietarios.schema.js';

export const propietariosRouter = Router();

propietariosRouter.use(authMiddleware, requireSuperAdmin);

propietariosRouter.get('/', listPropietariosController);
propietariosRouter.post('/', validateBody(propietarioCreateSchema), createPropietarioController);
propietariosRouter.get('/:id', getPropietarioController);
propietariosRouter.put('/:id', validateBody(propietarioUpdateSchema), updatePropietarioController);
propietariosRouter.patch(
  '/:id/estado',
  validateBody(propietarioEstadoSchema),
  updateEstadoPropietarioController
);
propietariosRouter.delete('/:id', deletePropietarioController);
