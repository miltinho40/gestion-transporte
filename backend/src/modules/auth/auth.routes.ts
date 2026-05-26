import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { acceptInvitationController, loginController, meController } from './auth.controller.js';
import { acceptInvitationSchema, loginSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/login', validateBody(loginSchema), loginController);
authRouter.post(
  '/aceptar-invitacion',
  validateBody(acceptInvitationSchema),
  acceptInvitationController
);
authRouter.get('/me', authMiddleware, meController);
