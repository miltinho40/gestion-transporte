import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  assignUsuarioPropietarioController,
  deleteUsuarioPropietarioController,
  getUsuarioPropietarioController,
  listUsuariosPropietariosController,
  updateUsuarioPropietarioController
} from './usuarios-propietarios.controller.js';
import {
  usuarioPropietarioCreateSchema,
  usuarioPropietarioUpdateSchema
} from './usuarios-propietarios.schema.js';

export const usuariosPropietariosRouter = Router();

usuariosPropietariosRouter.use(authMiddleware, requireSuperAdmin);

usuariosPropietariosRouter.get('/', listUsuariosPropietariosController);
usuariosPropietariosRouter.post(
  '/',
  validateBody(usuarioPropietarioCreateSchema),
  assignUsuarioPropietarioController
);
usuariosPropietariosRouter.get('/:id', getUsuarioPropietarioController);
usuariosPropietariosRouter.put(
  '/:id',
  validateBody(usuarioPropietarioUpdateSchema),
  updateUsuarioPropietarioController
);
usuariosPropietariosRouter.delete('/:id', deleteUsuarioPropietarioController);
