import bcrypt from 'bcryptjs';
import { TipoInvitacionUsuario } from '@prisma/client';
import { env } from '../../config/env.js';
import { signToken } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashInvitationToken } from '../../utils/user-invitations.js';
import type { AcceptInvitationInput, LoginInput } from './auth.schema.js';

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

export const login = async (input: LoginInput) => {
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

  if (!usuario?.activo) {
    throw new AppError('Credenciales invalidas', 401);
  }

  if (!usuario.password_hash) {
    throw new AppError('Debes crear tu clave desde el enlace de invitacion', 401);
  }

  const passwordValido = await bcrypt.compare(input.password, usuario.password_hash);

  if (!passwordValido) {
    throw new AppError('Credenciales invalidas', 401);
  }

  if (!usuario.es_super_admin && usuario.usuarios_propietarios.length === 0) {
    throw new AppError('Usuario sin propietarios asignados', 403);
  }

  const acceso = resolveAcceso(usuario, input.propietario_id);

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

  const passwordHash = await bcrypt.hash(input.password, 10);

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
