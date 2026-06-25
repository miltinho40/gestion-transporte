import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../config/jwt.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { parseBigIntId } from '../utils/ids.js';

export const authMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError('Token no enviado', 401);
  }

  const token = authorization.slice('Bearer '.length);
  const payload = (() => {
    try {
      return verifyToken(token);
    } catch {
      throw new AppError('Token invalido o expirado', 401);
    }
  })();

  const usuarioId = parseBigIntId(payload.usuario_id, 'usuario_id');
  const propietarioId = payload.propietario_id
    ? parseBigIntId(payload.propietario_id, 'propietario_id')
    : undefined;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      activo: true,
      es_super_admin: true,
      requiere_password: true
    }
  });

  if (!usuario?.activo) {
    throw new AppError('Usuario no disponible', 401);
  }

  const isPasswordSetupRoute =
    req.baseUrl.endsWith('/auth') && (req.path === '/me' || req.path === '/password');

  if (usuario.requiere_password && !isPasswordSetupRoute) {
    throw new AppError('Debes cambiar la clave temporal antes de continuar', 403);
  }

  if (!propietarioId) {
    req.user = {
      usuario_id: usuario.id.toString(),
      es_super_admin: usuario.es_super_admin,
      requiere_password: usuario.requiere_password
    };
    next();
    return;
  }

  const [propietario, acceso] = await Promise.all([
    prisma.propietario.findUnique({
      where: { id: propietarioId },
      select: {
        id: true,
        activo: true
      }
    }),
    prisma.usuarioPropietario.findFirst({
      where: {
        usuario_id: usuarioId,
        propietario_id: propietarioId,
        activo: true
      },
      include: {
        rol: true
      }
    })
  ]);

  if (!propietario?.activo) {
    throw new AppError('Propietario no disponible', 403);
  }

  if (!usuario.es_super_admin && !acceso) {
    throw new AppError('No tienes acceso al propietario seleccionado', 403);
  }

  req.user = {
    usuario_id: usuario.id.toString(),
    propietario_id: propietario.id.toString(),
    rol: acceso?.rol.nombre ?? payload.rol,
    permisos: acceso?.rol.permisos ?? payload.permisos,
    permisos_configurados: acceso?.rol.permisos_configurados ?? payload.permisos_configurados,
    es_super_admin: usuario.es_super_admin,
    requiere_password: usuario.requiere_password,
    es_propietario: usuario.es_super_admin || acceso?.es_propietario || payload.es_propietario,
    es_intermediario:
      usuario.es_super_admin || acceso?.es_intermediario || payload.es_intermediario
  };

  next();
};
