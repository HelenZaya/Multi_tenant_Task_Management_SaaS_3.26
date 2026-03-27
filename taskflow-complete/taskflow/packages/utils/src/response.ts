export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    requestId?: string;
  };
}

export function successResponse<T>(
  data: T,
  meta?: ApiResponse["meta"]
): ApiResponse<T> {
  return { success: true, data, meta };
}

export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, string[]>
): ApiResponse<never> {
  return {
    success: false,
    error: { code, message, details },
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): ApiResponse<T[]> {
  return {
    success: true,
    data,
    meta: { page, limit, total },
  };
}
