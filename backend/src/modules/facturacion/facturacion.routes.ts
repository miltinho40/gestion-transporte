import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
import { AppError } from '../../utils/app-error.js';
import {
  cerrarFacturaController,
  crearFacturaController,
  deshacerFacturaController,
  getConfiguracionFacturacionController,
  getFacturaController,
  guardarBorradorFacturaController,
  listBorradoresFacturaController,
  listFacturasController,
  listViajesFacturacionController,
  previsualizarFacturaController,
  registrarAbonoFacturaController,
  updateConfiguracionFacturacionController
} from './facturacion.controller.js';

export const facturacionRouter = Router();

facturacionRouter.use(authMiddleware, requirePropietarioContext, (req, _res, next) => {
  if (
    !req.user?.es_super_admin &&
    req.user?.permisos_configurados &&
    !req.user.permisos?.includes('facturacion')
  ) {
    throw new AppError('No tienes permiso de facturación', 403);
  }
  next();
});

const read = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const write = requireRoles('admin', 'operador');

facturacionRouter.get('/configuracion', read, getConfiguracionFacturacionController);
facturacionRouter.put('/configuracion', write, updateConfiguracionFacturacionController);
facturacionRouter.get('/viajes', read, listViajesFacturacionController);
facturacionRouter.post('/previsualizar', read, previsualizarFacturaController);
facturacionRouter.post('/', write, crearFacturaController);
facturacionRouter.get('/', read, listFacturasController);
facturacionRouter.get('/borradores', read, listBorradoresFacturaController);
facturacionRouter.get('/:id', read, getFacturaController);
facturacionRouter.post('/borradores', write, guardarBorradorFacturaController);
facturacionRouter.put('/:id/borrador', write, guardarBorradorFacturaController);
facturacionRouter.post('/:id/cerrar', write, cerrarFacturaController);
facturacionRouter.post('/:id/deshacer', write, deshacerFacturaController);
facturacionRouter.post('/:id/abonos', write, registrarAbonoFacturaController);
