import type { NextFunction, Request, Response } from 'express';
import { clientIpFromRequest } from '../utils/request-ip.js';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message: string;
};

export const createRateLimitMiddleware = (options: RateLimitOptions) => {
  const entries = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const userId = req.user?.usuario_id ? String(req.user.usuario_id) : 'anonymous';
    const key = `${userId}:${clientIpFromRequest(req) ?? 'unknown'}`;
    const current = entries.get(key);
    const entry =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + options.windowMs }
        : current;

    entry.count += 1;
    entries.set(key, entry);

    const remaining = Math.max(options.max - entry.count, 0);
    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > options.max) {
      res.setHeader('Retry-After', String(Math.max(Math.ceil((entry.resetAt - now) / 1000), 1)));
      res.status(429).json({ message: options.message });
      return;
    }

    if (entries.size > 1000) {
      for (const [entryKey, value] of entries) {
        if (value.resetAt <= now) entries.delete(entryKey);
      }
    }

    next();
  };
};
