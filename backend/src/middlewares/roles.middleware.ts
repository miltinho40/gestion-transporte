import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error.js';

export const requireRoles = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.es_super_admin) {
      next();
      return;
    }

    if (!req.user?.rol || !roles.includes(req.user.rol)) {
      throw new AppError('No tienes permisos para esta accion', 403);
    }

    next();
  };
};
