import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import type {
  UsuarioCreateInput,
  UsuarioEstadoInput,
  UsuarioPasswordInput,
  UsuarioUpdateInput
} from './usuarios.schema.js';

interface ListUsuariosFilters {
  search?: unknown;
  activo?: unknown;
  es_super_admin?: unknown;
}

const usuarioSelect = {
  id: true,
  nombre: true,
  email: true,
  fecha_nacimiento: true,
  es_super_admin: true,
  activo: true,
  created_at: true,
  updated_at: true,
  usuarios_propietarios: {
    where: {
      activo: true
    },
    include: {
      propietario: true,
      rol: true
    },
    orderBy: {
      propietario_id: 'asc'
    }
  }
} satisfies Prisma.UsuarioSelect;

const toDateOnly = (value?: string | null) => {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
};

const buildWhere = (filters: ListUsuariosFilters): Prisma.UsuarioWhereInput => {
  const where: Prisma.UsuarioWhereInput = {};

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (filters.activo === 'true') {
    where.activo = true;
  }

  if (filters.activo === 'false') {
    where.activo = false;
  }

  if (filters.es_super_admin === 'true') {
    where.es_super_admin = true;
  }

  if (filters.es_super_admin === 'false') {
    where.es_super_admin = false;
  }

  return where;
};

const ensureEmailAvailable = async (email: string, excludeId?: bigint) => {
  const existing = await prisma.usuario.findUnique({
    where: { email }
  });

  if (existing && existing.id !== excludeId) {
    throw new AppError('Ya existe un usuario con ese email', 409);
  }
};

export const listUsuarios = async (filters: ListUsuariosFilters) => {
  return prisma.usuario.findMany({
    where: buildWhere(filters),
    select: usuarioSelect,
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }]
  });
};

export const getUsuarioById = async (idInput: unknown) => {
  const id = parseBigIntId(idInput);

  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: usuarioSelect
  });

  if (!usuario) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return usuario;
};

export const createUsuario = async (input: UsuarioCreateInput) => {
  await ensureEmailAvailable(input.email);

  const password_hash = await bcrypt.hash(input.password, 10);

  return prisma.usuario.create({
    data: {
      nombre: input.nombre,
      email: input.email,
      password_hash,
      fecha_nacimiento: toDateOnly(input.fecha_nacimiento),
      es_super_admin: input.es_super_admin ?? false,
      activo: input.activo ?? true
    },
    select: usuarioSelect
  });
};

export const updateUsuario = async (idInput: unknown, input: UsuarioUpdateInput) => {
  const id = parseBigIntId(idInput);
  await getUsuarioById(id);

  if (input.email) {
    await ensureEmailAvailable(input.email, id);
  }

  return prisma.usuario.update({
    where: { id },
    data: {
      nombre: input.nombre,
      email: input.email,
      fecha_nacimiento:
        Object.hasOwn(input, 'fecha_nacimiento') ? toDateOnly(input.fecha_nacimiento) : undefined,
      es_super_admin: input.es_super_admin,
      activo: input.activo
    },
    select: usuarioSelect
  });
};

export const updateEstadoUsuario = async (idInput: unknown, input: UsuarioEstadoInput) => {
  const id = parseBigIntId(idInput);
  await getUsuarioById(id);

  return prisma.usuario.update({
    where: { id },
    data: { activo: input.activo },
    select: usuarioSelect
  });
};

export const updatePasswordUsuario = async (idInput: unknown, input: UsuarioPasswordInput) => {
  const id = parseBigIntId(idInput);
  await getUsuarioById(id);

  const password_hash = await bcrypt.hash(input.password, 10);

  return prisma.usuario.update({
    where: { id },
    data: { password_hash },
    select: usuarioSelect
  });
};

export const deactivateUsuario = async (idInput: unknown) => {
  const id = parseBigIntId(idInput);
  await getUsuarioById(id);

  return prisma.usuario.update({
    where: { id },
    data: { activo: false },
    select: usuarioSelect
  });
};
