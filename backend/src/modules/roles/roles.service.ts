import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';

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
