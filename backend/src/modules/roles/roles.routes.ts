import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { getRolController, listRolesController } from './roles.controller.js';

export const rolesRouter = Router();

rolesRouter.use(authMiddleware);

rolesRouter.get('/', listRolesController);
rolesRouter.get('/:id', getRolController);
