import { SentidoPeaje } from '@prisma/client';
import type { SentidoPeajeApi } from './rutas-peajes.schema.js';

const prismaToApiSentido = {
  [SentidoPeaje.IDA]: 'ida',
  [SentidoPeaje.RETORNO]: 'retorno',
  [SentidoPeaje.AMBOS]: 'ambos'
} satisfies Record<SentidoPeaje, SentidoPeajeApi>;

const apiToPrismaSentido = {
  ida: SentidoPeaje.IDA,
  retorno: SentidoPeaje.RETORNO,
  ambos: SentidoPeaje.AMBOS
} satisfies Record<SentidoPeajeApi, SentidoPeaje>;

export const toPrismaSentidoPeaje = (sentido?: SentidoPeajeApi) => {
  return sentido ? apiToPrismaSentido[sentido] : undefined;
};

export const formatRutaPeaje = <T extends { sentido: SentidoPeaje }>(rutaPeaje: T) => {
  return {
    ...rutaPeaje,
    sentido: prismaToApiSentido[rutaPeaje.sentido]
  };
};

export const formatRutasPeajes = <T extends { sentido: SentidoPeaje }>(items: T[]) => {
  return items.map(formatRutaPeaje);
};
