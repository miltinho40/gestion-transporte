import bcrypt from 'bcryptjs';
import { TipoInvitacionUsuario } from '@prisma/client';
import { env } from '../../config/env.js';
import { signToken } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashInvitationToken } from '../../utils/user-invitations.js';
import type { AcceptInvitationInput, ChangePasswordInput, LoginInput } from './auth.schema.js';

const PASSWORD_HASH_ROUNDS = 12;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

interface LoginContext {
  clientIp?: string;
}

interface FailedLoginState {
  attempts: number;
  lockedUntil: number | null;
}

const failedLoginAttempts = new Map<string, FailedLoginState>();

const parseId = (value: string) => {
  try {
    return BigInt(value);
  } catch {
    throw new AppError('Identificador invalido', 400);
  }
};

const getUsuarioConAccesos = async (usuarioId: bigint) => {
  return prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      usuarios_propietarios: {
        where: {
          activo: true,
          propietario: {
            activo: true
          }
        },
        include: {
          propietario: true,
          rol: true
        },
        orderBy: {
          propietario_id: 'asc'
        }
      }
    }
  });
};

type UsuarioConAccesos = NonNullable<Awaited<ReturnType<typeof getUsuarioConAccesos>>>;
type AccesoPropietario = UsuarioConAccesos['usuarios_propietarios'][number];

const buildAuthResponse = (usuario: UsuarioConAccesos, acceso?: AccesoPropietario) => {
  const token = signToken({
    usuario_id: usuario.id.toString(),
    propietario_id: acceso?.propietario_id.toString(),
    rol: acceso?.rol.nombre,
    es_super_admin: usuario.es_super_admin
  });

  return {
    token,
    token_type: 'Bearer',
    expires_in: env.JWT_EXPIRES_IN,
    usuario: {
      id: usuario.id.toString(),
      nombre: usuario.nombre,
      email: usuario.email,
      es_super_admin: usuario.es_super_admin
    },
    contexto: acceso
      ? {
          propietario_id: acceso.propietario_id.toString(),
          propietario_nombre: acceso.propietario.nombre,
          rol_id: acceso.rol_id.toString(),
          rol: acceso.rol.nombre
        }
      : null,
    propietarios: usuario.usuarios_propietarios.map((item) => ({
      id: item.propietario.id.toString(),
      nombre: item.propietario.nombre,
      ruc_cedula: item.propietario.ruc_cedula,
      rol: {
        id: item.rol.id.toString(),
        nombre: item.rol.nombre
      }
    }))
  };
};

const loginAttemptKey = (input: LoginInput, context?: LoginContext) => {
  return `${context?.clientIp ?? 'unknown'}:${input.email}`;
};

const assertLoginAllowed = (key: string) => {
  const state = failedLoginAttempts.get(key);
  const now = Date.now();

  if (!state?.lockedUntil) return;

  if (state.lockedUntil <= now) {
    failedLoginAttempts.delete(key);
    return;
  }

  throw new AppError('Demasiados intentos fallidos. Intenta nuevamente en unos minutos.', 429);
};

const recordFailedLogin = (key: string) => {
  const current = failedLoginAttempts.get(key) ?? { attempts: 0, lockedUntil: null };
  const attempts = current.attempts + 1;
  failedLoginAttempts.set(key, {
    attempts,
    lockedUntil: attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? Date.now() + LOGIN_LOCK_MS : null
  });
};

const clearFailedLogin = (key: string) => {
  failedLoginAttempts.delete(key);
};

const resolveAcceso = (usuario: UsuarioConAccesos, propietarioId?: string) => {
  if (propietarioId) {
    const id = parseId(propietarioId);
    const acceso = usuario.usuarios_propietarios.find((item) => item.propietario_id === id);

    if (!acceso) {
      throw new AppError('No tienes acceso al propietario seleccionado', 403);
    }

    return acceso;
  }

  if (usuario.usuarios_propietarios.length === 1) {
    return usuario.usuarios_propietarios[0];
  }

  return undefined;
};

export const login = async (input: LoginInput, context?: LoginContext) => {
  const attemptKey = loginAttemptKey(input, context);

  assertLoginAllowed(attemptKey);

  const usuario = await prisma.usuario.findUnique({
    where: { email: input.email },
    include: {
      usuarios_propietarios: {
        where: {
          activo: true,
          propietario: {
            activo: true
          }
        },
        include: {
          propietario: true,
          rol: true
        },
        orderBy: {
          propietario_id: 'asc'
        }
      }
    }
  });

  if (!usuario || !usuario.activo) {
    recordFailedLogin(attemptKey);
    throw new AppError('Credenciales invalidas', 401);
  }

  if (!usuario.password_hash) {
    recordFailedLogin(attemptKey);
    throw new AppError('Credenciales invalidas', 401);
  }

  const passwordHash = usuario.password_hash;
  const passwordValido = await bcrypt.compare(input.password, passwordHash);

  if (!passwordValido) {
    recordFailedLogin(attemptKey);
    throw new AppError('Credenciales invalidas', 401);
  }

  if (!usuario.es_super_admin && usuario.usuarios_propietarios.length === 0) {
    throw new AppError('Usuario sin propietarios asignados', 403);
  }

  const acceso = resolveAcceso(usuario, input.propietario_id);
  clearFailedLogin(attemptKey);

  return buildAuthResponse(usuario, acceso);
};

export const getMe = async (usuarioId: string, propietarioId?: string) => {
  const usuario = await getUsuarioConAccesos(parseId(usuarioId));

  if (!usuario?.activo) {
    throw new AppError('Usuario no disponible', 401);
  }

  const acceso = propietarioId ? resolveAcceso(usuario, propietarioId) : undefined;

  return buildAuthResponse(usuario, acceso);
};

export const changePassword = async (usuarioId: string, input: ChangePasswordInput) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: parseId(usuarioId) },
    select: {
      id: true,
      activo: true,
      password_hash: true
    }
  });

  if (!usuario?.activo) {
    throw new AppError('Usuario no disponible', 401);
  }

  if (!usuario.password_hash) {
    throw new AppError('El usuario aun no tiene una clave activa', 400);
  }

  const currentPasswordValid = await bcrypt.compare(input.current_password, usuario.password_hash);

  if (!currentPasswordValid) {
    throw new AppError('La clave actual no es correcta', 400);
  }

  const passwordHash = await bcrypt.hash(input.new_password, PASSWORD_HASH_ROUNDS);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      password_hash: passwordHash,
      requiere_password: false
    }
  });

  return {
    message: 'Clave actualizada correctamente'
  };
};

export const acceptInvitation = async (input: AcceptInvitationInput) => {
  const tokenHash = hashInvitationToken(input.token);
  const invitacion = await prisma.invitacionUsuario.findFirst({
    where: {
      token_hash: tokenHash,
      tipo: TipoInvitacionUsuario.CREAR_PASSWORD,
      usado: false,
      fecha_expiracion: {
        gte: new Date()
      }
    },
    include: {
      usuario: true
    }
  });

  if (!invitacion) {
    throw new AppError('Invitacion invalida o expirada', 400);
  }

  const passwordHash = await bcrypt.hash(input.password, PASSWORD_HASH_ROUNDS);

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: invitacion.usuario_id },
      data: {
        password_hash: passwordHash,
        email_verificado: true,
        requiere_password: false,
        activo: true
      }
    }),
    prisma.invitacionUsuario.update({
      where: { id: invitacion.id },
      data: {
        usado: true,
        fecha_uso: new Date()
      }
    })
  ]);

  return {
    message: 'Clave creada correctamente',
    email: invitacion.usuario.email
  };
};
