import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';

export const resolveDestinatarioViaje = async (owner:bigint, cliente:bigint, input:unknown) => {
  const config=input==null?await prisma.configuracionFacturacion.findUnique({where:{cliente_id:cliente}}):null;
  const id=input==null?config?.destinatario_id??cliente:parseBigIntId(input,'facturar_a_id');
  if(!await prisma.cliente.findFirst({where:{id,propietario_id:owner,activo:true}}))throw new AppError('La empresa a facturar no pertenece al propietario o está inactiva',400);
  return id;
};
