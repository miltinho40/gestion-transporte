import type { JwtPayload } from '../config/jwt.js';
import { AppError } from './app-error.js';
import { parseBigIntId } from './ids.js';

export const resolveReadScope = (user: JwtPayload | undefined) => {
  if (!user) {
    throw new AppError('Usuario no autenticado', 401);
  }

  if (user.es_super_admin && !user.propietario_id) {
    return {
      all: true,
      propietarioId: undefined
    };
  }

  if (!user.propietario_id) {
    throw new AppError('Debes seleccionar un propietario para esta accion', 400);
  }

  return {
    all: false,
    propietarioId: parseBigIntId(user.propietario_id, 'propietario_id')
  };
};

export const resolveWriteOwnerId = (
  user: JwtPayload | undefined,
  globalRequested?: boolean
) => {
  if (!user) {
    throw new AppError('Usuario no autenticado', 401);
  }

  if (user.es_super_admin && (globalRequested || !user.propietario_id)) {
    return null;
  }

  if (!user.propietario_id) {
    throw new AppError('Debes seleccionar un propietario para esta accion', 400);
  }

  return parseBigIntId(user.propietario_id, 'propietario_id');
};

export const assertCanWriteScopedRecord = (
  user: JwtPayload | undefined,
  recordOwnerId: bigint | null
) => {
  if (!user) {
    throw new AppError('Usuario no autenticado', 401);
  }

  if (recordOwnerId === null) {
    if (!user.es_super_admin) {
      throw new AppError('Solo super admin puede modificar registros globales', 403);
    }

    return;
  }

  if (user.es_super_admin) {
    return;
  }

  if (!user.propietario_id || parseBigIntId(user.propietario_id, 'propietario_id') !== recordOwnerId) {
    throw new AppError('No tienes acceso a este registro', 403);
  }
};
