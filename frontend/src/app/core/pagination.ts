export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export const isPaginatedResponse = <T>(value: T[] | PaginatedResponse<T>): value is PaginatedResponse<T> => {
  if (Array.isArray(value)) return false;
  return Boolean(value?.data && value?.meta);
};
