import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  DEFAULT_TEMPORARY_PASSWORD,
  hashDefaultTemporaryPassword
} from '../../utils/default-password.js';
import { parseBigIntId } from '../../utils/ids.js';
import { createPasswordInvitation } from '../../utils/user-invitations.js';
import { toPrismaEstadoSuscripcion } from './propietarios.mapper.js';
import type {
  PropietarioCreateInput,
  PropietarioEstadoInput,
  PropietarioUpdateInput
} from './propietarios.schema.js';

interface ListPropietariosFilters {
  search?: unknown;
  activo?: unknown;
  estado_suscripcion?: unknown;
}

const propietarioInclude = {
  vehiculos: {
    select: {
      estado: true,
      facturable: true
    }
  }
} satisfies Prisma.PropietarioInclude;

const buildWhere = (filters: ListPropietariosFilters): Prisma.PropietarioWhereInput => {
  const where: Prisma.PropietarioWhereInput = {};

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { ruc_cedula: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (filters.activo === 'true') {
    where.activo = true;
  }

  if (filters.activo === 'false') {
    where.activo = false;
  }

  if (
    filters.estado_suscripcion === 'activa' ||
    filters.estado_suscripcion === 'prueba' ||
    filters.estado_suscripcion === 'suspendida' ||
    filters.estado_suscripcion === 'cancelada'
  ) {
    where.estado_suscripcion = toPrismaEstadoSuscripcion(filters.estado_suscripcion);
  }

  return where;
};

export const listPropietarios = async (filters: ListPropietariosFilters) => {
  return prisma.propietario.findMany({
    where: buildWhere(filters),
    include: propietarioInclude,
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }]
  });
};

export const getPropietarioById = async (idInput: unknown) => {
  const id = parseBigIntId(idInput);

  const propietario = await prisma.propietario.findUnique({
    where: { id },
    include: propietarioInclude
  });

  if (!propietario) {
    throw new AppError('Propietario no encontrado', 404);
  }

  return propietario;
};

export const createPropietario = async (input: PropietarioCreateInput) => {
  const { admin, ...propietarioInput } = input;
  const result = await prisma.$transaction(async (tx) => {
    const propietario = await tx.propietario.create({
      data: {
        nombre: propietarioInput.nombre,
        ruc_cedula: propietarioInput.ruc_cedula,
        contacto_nombre: propietarioInput.contacto_nombre,
        telefono: propietarioInput.telefono,
        email: propietarioInput.email,
        direccion: propietarioInput.direccion,
        activo: propietarioInput.activo ?? true,
        estado_suscripcion: toPrismaEstadoSuscripcion(propietarioInput.estado_suscripcion),
        limite_vehiculos: propietarioInput.limite_vehiculos ?? 0,
        precio_por_vehiculo: propietarioInput.precio_por_vehiculo ?? 0,
        fecha_corte_facturacion: propietarioInput.fecha_corte_facturacion ?? 1,
        observaciones_facturacion: propietarioInput.observaciones_facturacion
      }
    });

    if (!admin) {
      return {
        propietario,
        admin_usuario: null,
        admin_usuario_id: null,
        debe_enviar_invitacion: false
      };
    }

    const rolAdmin = await tx.rol.findUnique({
      where: { nombre: 'admin' }
    });

    if (!rolAdmin) {
      throw new AppError('Rol admin no configurado', 500);
    }

    const usuarioExistente = await tx.usuario.findUnique({
      where: { email: admin.email }
    });
    const debeAsignarClaveTemporal = !usuarioExistente?.password_hash;
    const passwordHashTemporal = debeAsignarClaveTemporal
      ? await hashDefaultTemporaryPassword()
      : undefined;
    const usuario = usuarioExistente
      ? await tx.usuario.update({
          where: { id: usuarioExistente.id },
          data: {
            nombre: admin.nombre,
            fecha_nacimiento: admin.fecha_nacimiento
              ? new Date(`${admin.fecha_nacimiento}T00:00:00.000Z`)
              : usuarioExistente.fecha_nacimiento,
            email_verificado: usuarioExistente.password_hash
              ? usuarioExistente.email_verificado
              : true,
            password_hash: passwordHashTemporal,
            requiere_password: usuarioExistente.password_hash
              ? usuarioExistente.requiere_password
              : true,
            activo: true
          }
        })
      : await tx.usuario.create({
          data: {
            nombre: admin.nombre,
            email: admin.email,
            password_hash: passwordHashTemporal,
            fecha_nacimiento: admin.fecha_nacimiento
              ? new Date(`${admin.fecha_nacimiento}T00:00:00.000Z`)
              : null,
            es_super_admin: false,
            email_verificado: true,
            requiere_password: true,
            activo: true
          }
        });

    await tx.usuarioPropietario.upsert({
      where: {
        usuario_id_propietario_id: {
          usuario_id: usuario.id,
          propietario_id: propietario.id
        }
      },
      update: {
        rol_id: rolAdmin.id,
        activo: true
      },
      create: {
        usuario_id: usuario.id,
        propietario_id: propietario.id,
        rol_id: rolAdmin.id,
        activo: true
      }
    });

    return {
      propietario,
      admin_usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email
      },
      admin_usuario_id: usuario.id,
      debe_enviar_invitacion: false,
      clave_temporal: debeAsignarClaveTemporal ? DEFAULT_TEMPORARY_PASSWORD : null
    };
  });

  if (!result.admin_usuario || !result.admin_usuario_id || !result.debe_enviar_invitacion) {
    return {
      propietario: result.propietario,
      admin_usuario: result.admin_usuario,
      invitacion: null,
      clave_temporal: result.clave_temporal
    };
  }

  const invitacion = await createPasswordInvitation({
    usuario_id: result.admin_usuario_id,
    propietario_id: result.propietario.id,
    email: result.admin_usuario.email,
    nombre: result.admin_usuario.nombre,
    propietario_nombre: result.propietario.nombre
  });

  return {
    propietario: result.propietario,
    admin_usuario: result.admin_usuario,
    invitacion,
    clave_temporal: result.clave_temporal
  };
};

export const updatePropietario = async (idInput: unknown, input: PropietarioUpdateInput) => {
  const id = parseBigIntId(idInput);
  await getPropietarioById(id);

  return prisma.propietario.update({
    where: { id },
    data: {
      nombre: input.nombre,
      ruc_cedula: input.ruc_cedula,
      contacto_nombre: Object.hasOwn(input, 'contacto_nombre') ? input.contacto_nombre : undefined,
      telefono: Object.hasOwn(input, 'telefono') ? input.telefono : undefined,
      email: Object.hasOwn(input, 'email') ? input.email : undefined,
      direccion: Object.hasOwn(input, 'direccion') ? input.direccion : undefined,
      activo: input.activo,
      estado_suscripcion: toPrismaEstadoSuscripcion(input.estado_suscripcion),
      limite_vehiculos: input.limite_vehiculos,
      precio_por_vehiculo: input.precio_por_vehiculo,
      fecha_corte_facturacion: input.fecha_corte_facturacion,
      observaciones_facturacion: Object.hasOwn(input, 'observaciones_facturacion')
        ? input.observaciones_facturacion
        : undefined
    },
    include: propietarioInclude
  });
};

export const updateEstadoPropietario = async (
  idInput: unknown,
  input: PropietarioEstadoInput
) => {
  const id = parseBigIntId(idInput);
  await getPropietarioById(id);

  return prisma.propietario.update({
    where: { id },
    data: { activo: input.activo },
    include: propietarioInclude
  });
};

export const deactivatePropietario = async (idInput: unknown) => {
  const id = parseBigIntId(idInput);
  await getPropietarioById(id);

  return prisma.propietario.update({
    where: { id },
    data: { activo: false },
    include: propietarioInclude
  });
};
