export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function calculatePages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  return {
    items,
    total,
    page: params.page,
    limit: params.limit,
    pages: calculatePages(total, params.limit),
  };
}
