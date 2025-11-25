/**
 * Common Domain Types
 * 
 * Common utility types used across domains.
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    offset: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

