import type { Request } from 'express';

export const normalizeIpAddress = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  return normalized.startsWith('::ffff:')
    ? normalized.slice('::ffff:'.length)
    : normalized;
};

export const clientIpFromRequest = (req: Request) =>
  normalizeIpAddress(req.ip);
