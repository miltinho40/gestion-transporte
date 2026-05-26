import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createRutaPeajeController,
  deleteRutaPeajeController,
  getRutaPeajeController,
  listRutasPeajesController,
  updateRutaPeajeController
} from './rutas-peajes.controller.js';
import { rutaPeajeCreateSchema, rutaPeajeUpdateSchema } from './rutas-peajes.schema.js';

export const rutasPeajesRouter = Router();

const canManage = requireSuperAdmin;

rutasPeajesRouter.use(authMiddleware);

rutasPeajesRouter.get('/', canManage, listRutasPeajesController);
rutasPeajesRouter.post('/', canManage, validateBody(rutaPeajeCreateSchema), createRutaPeajeController);
rutasPeajesRouter.get('/:id', canManage, getRutaPeajeController);
rutasPeajesRouter.put('/:id', canManage, validateBody(rutaPeajeUpdateSchema), updateRutaPeajeController);
rutasPeajesRouter.delete('/:id', canManage, deleteRutaPeajeController);
