import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
import {
  exportReporteMantenimientosController,
  exportReporteUtilidadController,
  exportReporteViajesController,
  reporteMantenimientosController,
  reporteUtilidadController,
  reporteViajesController
} from './reportes.controller.js';

export const reportesRouter = Router();

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');

reportesRouter.use(authMiddleware, requirePropietarioContext);

reportesRouter.get('/utilidad/export', canRead, exportReporteUtilidadController);
reportesRouter.get('/utilidad', canRead, reporteUtilidadController);
reportesRouter.get('/viajes/export', canRead, exportReporteViajesController);
reportesRouter.get('/viajes', canRead, reporteViajesController);
reportesRouter.get('/mantenimientos/export', canRead, exportReporteMantenimientosController);
reportesRouter.get('/mantenimientos', canRead, reporteMantenimientosController);
