import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { createRateLimitMiddleware } from '../../middlewares/rate-limit.middleware.js';
import {
  requirePropietarioContextOrSuperAdmin,
  requireRoles,
  requireSuperAdmin
} from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  asistenteEvaluacionSchema,
  asistenteMensajeSchema,
  asistenteRevisionSchema
} from './asistente.schema.js';
import {
  evaluarRespuestaAsistenteController,
  listarEvaluacionesAsistenteController,
  obtenerConversacionAsistenteController,
  procesarMensajeAsistenteController,
  revisarEvaluacionAsistenteController
} from './asistente.controller.js';

export const asistenteRouter = Router();

const assistantRateLimit = createRateLimitMiddleware({
  windowMs: 60_000,
  max: 30,
  message: 'Has enviado demasiadas solicitudes al asistente. Intenta nuevamente en un minuto.'
});

asistenteRouter.use(authMiddleware, requirePropietarioContextOrSuperAdmin, assistantRateLimit);
asistenteRouter.get(
  '/conversaciones/:id',
  requireRoles('admin', 'operador', 'supervisor', 'consulta'),
  obtenerConversacionAsistenteController
);
asistenteRouter.get(
  '/evaluaciones',
  requireSuperAdmin,
  listarEvaluacionesAsistenteController
);
asistenteRouter.post(
  '/mensaje',
  requireRoles('admin', 'operador', 'supervisor', 'consulta'),
  validateBody(asistenteMensajeSchema),
  procesarMensajeAsistenteController
);
asistenteRouter.put(
  '/mensajes/:id/evaluacion',
  requireRoles('admin', 'operador', 'supervisor', 'consulta'),
  validateBody(asistenteEvaluacionSchema),
  evaluarRespuestaAsistenteController
);
asistenteRouter.patch(
  '/evaluaciones/:id/revision',
  requireSuperAdmin,
  validateBody(asistenteRevisionSchema),
  revisarEvaluacionAsistenteController
);
