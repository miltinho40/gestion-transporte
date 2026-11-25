import type { Prisma } from '@prisma/client';

export interface TarifaConRuta {
  ruta_inversa?: boolean;
  ruta: { origen: string; destino: string };
}

// The shared route stays unchanged; only the tariff's operational direction is projected.
export const rutaDeTarifa = <T extends TarifaConRuta>(tarifa: T): T['ruta'] =>
  tarifa.ruta_inversa
    ? { ...tarifa.ruta, origen: tarifa.ruta.destino, destino: tarifa.ruta.origen }
    : { ...tarifa.ruta };

export const formatTarifaRuta = <T extends TarifaConRuta>(tarifa: T) => ({
  ...tarifa,
  ruta: rutaDeTarifa(tarifa)
});

export const destinoTarifaWhere = (destino: string): Prisma.TarifaRutaWhereInput => ({
  OR: [
    { ruta_inversa: false, ruta: { destino: { contains: destino, mode: 'insensitive' } } },
    { ruta_inversa: true, ruta: { origen: { contains: destino, mode: 'insensitive' } } }
  ]
});
