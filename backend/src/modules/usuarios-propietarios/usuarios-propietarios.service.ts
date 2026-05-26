import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import type {
  UsuarioPropietarioCreateInput,
  UsuarioPropietarioUpdateInput
} from './usuarios-propietarios.schema.js';

interface ListFilters {
  usuario_id?: unknown;
  propietario_id?: unknown;
  activo?: unknown;
}

const includeContext = {
  usuario: {
    select: {
      id: true,
      nombre: true,
      email: true,
      es_super_admin: true,
      activo: true
    }
  },
  propietario: true,
  rol: true
} satisfies Prisma.UsuarioPropietarioInclude;

const buildWhere = (filters: ListFilters): Prisma.UsuarioPropietarioWhereInput => {
  const where: Prisma.UsuarioPropietarioWhereInput = {};

  if (filters.usuario_id) {
    where.usuario_id = parseBigIntId(filters.usuario_id, 'usuario_id');
  }

  if (filters.propietario_id) {
    where.propietario_id = parseBigIntId(filters.propietario_id, 'propietario_id');
  }

  if (filters.activo === 'true') {
    where.activo = true;
  }

  if (filters.activo === 'false') {
    where.activo = false;
  }

  return where;
};

const validateAssignmentEntities = async (
  usuarioId: bigint,
  propietarioId: bigint,
  rolId: bigint
) => {
  const [usuario, propietario, rol] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId } }),
    prisma.propietario.findUnique({ where: { id: propietarioId } }),
    prisma.rol.findUnique({ where: { id: rolId } })
  ]);

  if (!usuario?.activo) {
    throw new AppError('Usuario no encontrado o inactivo', 404);
  }

  if (!propietario?.activo) {
    throw new AppError('Propietario no encontrado o inactivo', 404);
  }

  if (!rol) {
    throw new AppError('Rol no encontrado', 404);
  }
};

export const listUsuariosPropietarios = async (filters: ListFilters) => {
  return prisma.usuarioPropietario.findMany({
    where: buildWhere(filters),
    include: includeContext,
    orderBy: [{ activo: 'desc' }, { propietario_id: 'asc' }]
  });
};

export const getUsuarioPropietarioById = async (idInput: unknown) => {
  const id = parseBigIntId(idInput);

  const item = await prisma.usuarioPropietario.findUnique({
    where: { id },
    include: includeContext
  });

  if (!item) {
    throw new AppError('Asignacion no encontrada', 404);
  }

  return item;
};

export const assignUsuarioPropietario = async (input: UsuarioPropietarioCreateInput) => {
  const usuario_id = parseBigIntId(input.usuario_id, 'usuario_id');
  const propietario_id = parseBigIntId(input.propietario_id, 'propietario_id');
  const rol_id = parseBigIntId(input.rol_id, 'rol_id');

  await validateAssignmentEntities(usuario_id, propietario_id, rol_id);

  return prisma.usuarioPropietario.upsert({
    where: {
      usuario_id_propietario_id: {
        usuario_id,
        propietario_id
      }
    },
    update: {
      rol_id,
      activo: true
    },
    create: {
      usuario_id,
      propietario_id,
      rol_id
    },
    include: includeContext
  });
};

export const updateUsuarioPropietario = async (
  idInput: unknown,
  input: UsuarioPropietarioUpdateInput
) => {
  const id = parseBigIntId(idInput);
  const current = await getUsuarioPropietarioById(id);

  if (input.rol_id) {
    const rol = await prisma.rol.findUnique({
      where: { id: parseBigIntId(input.rol_id, 'rol_id') }
    });

    if (!rol) {
      throw new AppError('Rol no encontrado', 404);
    }
  }

  return prisma.usuarioPropietario.update({
    where: { id: current.id },
    data: {
      rol_id: input.rol_id ? parseBigIntId(input.rol_id, 'rol_id') : undefined,
      activo: input.activo
    },
    include: includeContext
  });
};

export const deactivateUsuarioPropietario = async (idInput: unknown) => {
  const id = parseBigIntId(idInput);
  const current = await getUsuarioPropietarioById(id);

  return prisma.usuarioPropietario.update({
    where: { id: current.id },
    data: { activo: false },
    include: includeContext
  });
};
