import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createGastoSemanalController,
  deleteGastoSemanalController,
  generarGastosCierreSemanalController,
  getCierreSemanalController,
  listGastosSemanalesController,
  updateGastoSemanalController
} from './cierres-semanales.controller.js';
import {
  cierreSemanalGenerarGastosSchema,
  gastoSemanalCreateSchema,
  gastoSemanalUpdateSchema
} from './cierres-semanales.schema.js';

export const cierresSemanalesRouter = Router();

const canRead = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWrite = requireRoles('admin', 'operador');

cierresSemanalesRouter.use(authMiddleware, requirePropietarioContext);

cierresSemanalesRouter.get('/', canRead, getCierreSemanalController);
cierresSemanalesRouter.post(
  '/generar-gastos',
  canWrite,
  validateBody(cierreSemanalGenerarGastosSchema),
  generarGastosCierreSemanalController
);
cierresSemanalesRouter.get('/gastos', canRead, listGastosSemanalesController);
cierresSemanalesRouter.post(
  '/gastos',
  canWrite,
  validateBody(gastoSemanalCreateSchema),
  createGastoSemanalController
);
cierresSemanalesRouter.put(
  '/gastos/:id',
  canWrite,
  validateBody(gastoSemanalUpdateSchema),
  updateGastoSemanalController
);
cierresSemanalesRouter.delete('/gastos/:id', canWrite, deleteGastoSemanalController);
