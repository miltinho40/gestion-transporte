import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import type { RolCreateInput, RolUpdateInput } from './roles.schema.js';

export const listRoles = async () => {
  return prisma.rol.findMany({
    orderBy: { nombre: 'asc' }
  });
};

export const getRolById = async (idInput: unknown) => {
  const id = parseBigIntId(idInput);

  const rol = await prisma.rol.findUnique({
    where: { id }
  });

  if (!rol) {
    throw new AppError('Rol no encontrado', 404);
  }

  return rol;
};

export const createRol = async (input: RolCreateInput) => {
  const nombre = input.nombre.trim().toLowerCase();
  const existing = await prisma.rol.findUnique({
    where: { nombre }
  });

  if (existing) {
    throw new AppError('Ya existe un rol con ese nombre', 409);
  }

  return prisma.rol.create({
    data: {
      nombre,
      descripcion: input.descripcion?.trim() || null,
      permisos: input.permisos ?? [],
      permisos_configurados: input.permisos_configurados ?? Boolean(input.permisos?.length)
    }
  });
};

export const updateRol = async (idInput: unknown, input: RolUpdateInput) => {
  const current = await getRolById(idInput);
  const nombre = input.nombre?.trim().toLowerCase();

  if (nombre && nombre !== current.nombre) {
    const existing = await prisma.rol.findUnique({
      where: { nombre }
    });

    if (existing) {
      throw new AppError('Ya existe un rol con ese nombre', 409);
    }
  }

  return prisma.rol.update({
    where: { id: current.id },
    data: {
      nombre,
      descripcion: input.descripcion === undefined ? undefined : input.descripcion?.trim() || null,
      permisos: input.permisos,
      permisos_configurados: input.permisos_configurados
    }
  });
};

export const deleteRol = async (idInput: unknown) => {
  const current = await getRolById(idInput);
  const assignments = await prisma.usuarioPropietario.count({
    where: { rol_id: current.id }
  });

  if (assignments > 0) {
    throw new AppError('No se puede eliminar un rol asignado a usuarios', 409);
  }

  return prisma.rol.delete({
    where: { id: current.id }
  });
};
