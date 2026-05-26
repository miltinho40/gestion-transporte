import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../config/jwt.js';
import { AppError } from '../utils/app-error.js';

export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError('Token no enviado', 401);
  }

  const token = authorization.slice('Bearer '.length);
  try {
    req.user = verifyToken(token);
  } catch {
    throw new AppError('Token invalido o expirado', 401);
  }

  next();
};
