import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createRutaController,
  deleteRutaController,
  getRutaController,
  listRutasController,
  updateEstadoRutaController,
  updateRutaController
} from './rutas.controller.js';
import { rutaCreateSchema, rutaEstadoSchema, rutaUpdateSchema } from './rutas.schema.js';

export const rutasRouter = Router();

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWrite = requireRoles('admin', 'operador');

rutasRouter.use(authMiddleware);

rutasRouter.get('/', canRead, listRutasController);
rutasRouter.post('/', canWrite, validateBody(rutaCreateSchema), createRutaController);
rutasRouter.get('/:id', canRead, getRutaController);
rutasRouter.put('/:id', canWrite, validateBody(rutaUpdateSchema), updateRutaController);
rutasRouter.patch('/:id/estado', canWrite, validateBody(rutaEstadoSchema), updateEstadoRutaController);
rutasRouter.delete('/:id', canWrite, deleteRutaController);
