import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error.js';

export const requireSuperAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user?.es_super_admin) {
    throw new AppError('Se requiere acceso de super admin', 403);
  }

  next();
};

export const requirePropietarioContext = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user?.propietario_id) {
    throw new AppError('Debes seleccionar un propietario para esta accion', 400);
  }

  next();
};

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
