import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { parseBigIntId } from './ids.js';

export interface AuditContext {
  propietarioId?: unknown;
  usuarioId?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditEventInput extends AuditContext {
  entidad: string;
  entidadId?: unknown;
  accion: string;
  resumen?: string | null;
  antes?: unknown;
  despues?: unknown;
}

const truncate = (value: string | null | undefined, maxLength: number) => {
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
};

const normalizeJson = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined) return undefined;

  return JSON.parse(
    JSON.stringify(value, (_key, innerValue) => {
      if (typeof innerValue === 'bigint') return innerValue.toString();
      if (innerValue instanceof Prisma.Decimal) return innerValue.toString();
      return innerValue;
    })
  ) as Prisma.InputJsonValue;
};

export const auditContextFromRequest = (req: Request): AuditContext => ({
  propietarioId: req.user?.propietario_id,
  usuarioId: req.user?.usuario_id,
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null
});

export const recordAuditEvent = async (input: AuditEventInput) => {
  try {
    await prisma.auditoriaEvento.create({
      data: {
        propietario_id:
          input.propietarioId === undefined
            ? null
            : parseBigIntId(input.propietarioId, 'propietario_id'),
        usuario_id:
          input.usuarioId === undefined ? null : parseBigIntId(input.usuarioId, 'usuario_id'),
        entidad: truncate(input.entidad, 80)!,
        entidad_id: input.entidadId === undefined ? null : truncate(String(input.entidadId), 80),
        accion: truncate(input.accion, 80)!,
        resumen: truncate(input.resumen, 255),
        antes: normalizeJson(input.antes),
        despues: normalizeJson(input.despues),
        ip: truncate(input.ip, 64),
        user_agent: truncate(input.userAgent, 255)
      }
    });
  } catch (error) {
    console.error('[audit skipped]', error);
  }
};
