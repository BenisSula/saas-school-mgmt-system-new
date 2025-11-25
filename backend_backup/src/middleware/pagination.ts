import { Request, Response, NextFunction } from 'express';

export interface PaginationParams {
  limit: number;
  offset: number;
  page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total?: number;
    page?: number;
    totalPages?: number;
  };
}

declare module 'express-serve-static-core' {
  interface Request {
    pagination?: PaginationParams;
  }
}

/**
 * Parse and validate pagination parameters from query string
 */
export function parsePagination(req: Request, _res: Response, next: NextFunction) {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
  const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
  
  req.pagination = {
    limit,
    offset: offset || (page - 1) * limit,
    page
  };
  
  next();
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number | undefined,
  pagination: PaginationParams
): PaginatedResponse<T> {
  const totalPages = total !== undefined ? Math.ceil(total / pagination.limit) : undefined;
  
  return {
    data,
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      total,
      page: pagination.page,
      totalPages
    }
  };
}

