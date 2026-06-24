import { AppError } from './app-error.js';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

const parsePositiveInt = (value: unknown, field: string) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${field} debe ser un entero positivo`, 400);
  }

  return parsed;
};

export const parsePagination = (
  query: Record<string, unknown>,
  options: { defaultLimit?: number; maxLimit?: number } = {}
): PaginationParams | null => {
  if (query.page === undefined && query.limit === undefined) {
    return null;
  }

  const maxLimit = options.maxLimit ?? 100;
  const page = query.page === undefined ? 1 : parsePositiveInt(query.page, 'page');
  const requestedLimit =
    query.limit === undefined
      ? options.defaultLimit ?? 50
      : parsePositiveInt(query.limit, 'limit');
  const limit = Math.min(requestedLimit, maxLimit);

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

export const buildPaginatedResult = <T>(
  data: T[],
  total: number,
  pagination: PaginationParams
): PaginatedResult<T> => {
  const totalPages = Math.max(1, Math.ceil(total / pagination.limit));

  return {
    data,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      total_pages: totalPages,
      has_next: pagination.page < totalPages,
      has_previous: pagination.page > 1
    }
  };
};

export const isPaginatedResult = <T>(
  value: T[] | PaginatedResult<T>
): value is PaginatedResult<T> => !Array.isArray(value);

export const mapPaginatedResult = <T, U>(
  value: T[] | PaginatedResult<T>,
  mapper: (rows: T[]) => U[]
): U[] | PaginatedResult<U> => {
  if (isPaginatedResult(value)) {
    return {
      data: mapper(value.data),
      meta: value.meta
    };
  }

  return mapper(value);
};
