import { AppError } from './app-error.js';

export const parseBigIntId = (value: unknown, field = 'id') => {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new AppError(`${field} invalido`, 400);
  }

  try {
    const parsed = BigInt(value);

    if (parsed <= 0n) {
      throw new Error('invalid');
    }

    return parsed;
  } catch {
    throw new AppError(`${field} invalido`, 400);
  }
};
