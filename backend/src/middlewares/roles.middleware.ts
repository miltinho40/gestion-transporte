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

export const requirePropietarioContextOrSuperAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (req.user?.es_super_admin || req.user?.propietario_id) {
    next();
    return;
  }

  throw new AppError('Debes seleccionar un propietario para esta accion', 400);
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

export const requireIntermediario = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.es_super_admin || req.user?.es_intermediario) {
    next();
    return;
  }

  throw new AppError('Se requiere acceso de intermediario para esta accion', 403);
};

export const requirePropietarioOperativo = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.es_super_admin || req.user?.es_propietario) {
    next();
    return;
  }

  throw new AppError('Se requiere acceso de propietario para esta accion', 403);
};
