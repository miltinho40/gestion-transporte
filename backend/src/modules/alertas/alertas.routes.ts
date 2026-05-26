import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
import {
  listAlertasController,
  listAlertasLicenciasController,
  listAlertasMantenimientosController,
  listAlertasViajesSinCobrarController
} from './alertas.controller.js';

export const alertasRouter = Router();

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');

alertasRouter.use(authMiddleware, requirePropietarioContext);

alertasRouter.get('/', canRead, listAlertasController);
alertasRouter.get('/mantenimientos', canRead, listAlertasMantenimientosController);
alertasRouter.get('/licencias', canRead, listAlertasLicenciasController);
alertasRouter.get('/viajes-sin-cobrar', canRead, listAlertasViajesSinCobrarController);
