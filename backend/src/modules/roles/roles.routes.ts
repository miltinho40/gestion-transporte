import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createRolController,
  deleteRolController,
  getRolController,
  listRolesController,
  updateRolController
} from './roles.controller.js';
import { rolCreateSchema, rolUpdateSchema } from './roles.schema.js';

export const rolesRouter = Router();

rolesRouter.use(authMiddleware);

rolesRouter.get('/', listRolesController);
rolesRouter.post('/', requireSuperAdmin, validateBody(rolCreateSchema), createRolController);
rolesRouter.get('/:id', getRolController);
rolesRouter.put('/:id', requireSuperAdmin, validateBody(rolUpdateSchema), updateRolController);
rolesRouter.delete('/:id', requireSuperAdmin, deleteRolController);
