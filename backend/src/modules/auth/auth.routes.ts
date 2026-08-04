import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { createRateLimitMiddleware } from '../../middlewares/rate-limit.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  acceptInvitationController,
  changePasswordController,
  loginController,
  logoutController,
  refreshController,
  meController
} from './auth.controller.js';
import { acceptInvitationSchema, changePasswordSchema, loginSchema } from './auth.schema.js';

export const authRouter = Router();

const loginRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde.'
});
const refreshRateLimit = createRateLimitMiddleware({
  windowMs: 60_000,
  max: 60,
  message: 'Demasiadas solicitudes de sesión. Intenta nuevamente en un minuto.'
});

authRouter.post('/login', loginRateLimit, validateBody(loginSchema), loginController);
authRouter.post('/refresh', refreshRateLimit, refreshController);
authRouter.post('/logout', refreshRateLimit, logoutController);
authRouter.post(
  '/aceptar-invitacion',
  validateBody(acceptInvitationSchema),
  acceptInvitationController
);
authRouter.get('/me', authMiddleware, meController);
authRouter.patch(
  '/password',
  authMiddleware,
  validateBody(changePasswordSchema),
  changePasswordController
);
