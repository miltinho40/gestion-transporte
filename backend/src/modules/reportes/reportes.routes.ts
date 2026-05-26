import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
import {
  exportReporteMantenimientosController,
  reporteMantenimientosController
} from './reportes.controller.js';

export const reportesRouter = Router();

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');

reportesRouter.use(authMiddleware, requirePropietarioContext);

reportesRouter.get('/mantenimientos/export', canRead, exportReporteMantenimientosController);
reportesRouter.get('/mantenimientos', canRead, reporteMantenimientosController);
