import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export const authRouter = Router();

authRouter.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: req.user
  });
});
