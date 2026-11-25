import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';

export const assertViajeSinFactura = async (id: bigint, tipo: 'propio' | 'proveedor') => {
  const detalle = await prisma.detalleFacturaTransporte.findFirst({ where: tipo === 'propio' ? { viaje_id: id } : { viaje_proveedor_id: id } });
  if (detalle) throw new AppError('El viaje está reservado en Facturación. Revisa su factura antes de modificar el viaje o registrar su cobro.', 409);
};
