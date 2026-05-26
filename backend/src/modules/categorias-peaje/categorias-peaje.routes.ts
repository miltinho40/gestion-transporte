import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles, requireSuperAdmin } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createCategoriaPeajeController,
  deleteCategoriaPeajeController,
  getCategoriaPeajeController,
  listCategoriasPeajeController,
  updateCategoriaPeajeController,
  updateEstadoCategoriaPeajeController
} from './categorias-peaje.controller.js';
import {
  categoriaPeajeCreateSchema,
  categoriaPeajeEstadoSchema,
  categoriaPeajeUpdateSchema
} from './categorias-peaje.schema.js';

export const categoriasPeajeRouter = Router();

const canManage = requireSuperAdmin;
const canReadCatalog = requireRoles('admin', 'operador', 'supervisor', 'consulta');

categoriasPeajeRouter.use(authMiddleware);

categoriasPeajeRouter.get('/', canManage, listCategoriasPeajeController);
categoriasPeajeRouter.post(
  '/',
  canManage,
  validateBody(categoriaPeajeCreateSchema),
  createCategoriaPeajeController
);
categoriasPeajeRouter.get('/catalogo', canReadCatalog, listCategoriasPeajeController);
categoriasPeajeRouter.get('/:id', canManage, getCategoriaPeajeController);
categoriasPeajeRouter.put(
  '/:id',
  canManage,
  validateBody(categoriaPeajeUpdateSchema),
  updateCategoriaPeajeController
);
categoriasPeajeRouter.patch(
  '/:id/estado',
  canManage,
  validateBody(categoriaPeajeEstadoSchema),
  updateEstadoCategoriaPeajeController
);
categoriasPeajeRouter.delete('/:id', canManage, deleteCategoriaPeajeController);
