import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
import {
  exportReporteIngresosEgresosSemanalController,
  exportReporteViajesConductorSemanalController,
  exportReporteViajesVehiculoSemanalController,
  reporteIngresosEgresosSemanalController,
  reporteViajesConductorSemanalController,
  reporteViajesVehiculoSemanalController
} from './reportes-semanales.controller.js';

export const reportesSemanalesRouter = Router();

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');

reportesSemanalesRouter.use(authMiddleware, requirePropietarioContext);

reportesSemanalesRouter.get(
  '/viajes-conductor/export',
  canRead,
  exportReporteViajesConductorSemanalController
);
reportesSemanalesRouter.get('/viajes-conductor', canRead, reporteViajesConductorSemanalController);
reportesSemanalesRouter.get(
  '/viajes-vehiculo/export',
  canRead,
  exportReporteViajesVehiculoSemanalController
);
reportesSemanalesRouter.get('/viajes-vehiculo', canRead, reporteViajesVehiculoSemanalController);
reportesSemanalesRouter.get(
  '/ingresos-egresos/export',
  canRead,
  exportReporteIngresosEgresosSemanalController
);
reportesSemanalesRouter.get('/ingresos-egresos', canRead, reporteIngresosEgresosSemanalController);
