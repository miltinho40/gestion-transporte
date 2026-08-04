import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createUsuarioController,
  deleteUsuarioController,
  getUsuarioController,
  listUsuariosController,
  resetPasswordUsuarioController,
  updateEstadoUsuarioController,
  updatePasswordUsuarioController,
  updateUsuarioController
} from './usuarios.controller.js';
import {
  usuarioCreateSchema,
  usuarioEstadoSchema,
  usuarioPasswordSchema,
  usuarioUpdateSchema
} from './usuarios.schema.js';

export const usuariosRouter = Router();

usuariosRouter.use(authMiddleware, requireSuperAdmin);

usuariosRouter.get('/', listUsuariosController);
usuariosRouter.post('/', validateBody(usuarioCreateSchema), createUsuarioController);
usuariosRouter.get('/:id', getUsuarioController);
usuariosRouter.put('/:id', validateBody(usuarioUpdateSchema), updateUsuarioController);
usuariosRouter.patch('/:id/estado', validateBody(usuarioEstadoSchema), updateEstadoUsuarioController);
usuariosRouter.patch(
  '/:id/password',
  validateBody(usuarioPasswordSchema),
  updatePasswordUsuarioController
);
usuariosRouter.patch('/:id/reset-password', resetPasswordUsuarioController);
usuariosRouter.delete('/:id', deleteUsuarioController);
