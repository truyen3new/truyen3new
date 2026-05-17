/**
 * Unified API response envelope for all endpoints.
 * Used by api-gateway, domain workers, edge functions.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
  correlationId?: string;
}

export function successResponse<T>(data: T, correlationId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    correlationId,
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, any>,
  correlationId?: string
): ApiResponse {
  return {
    success: false,
    error: { code, message, details },
    timestamp: new Date().toISOString(),
    correlationId,
  };
}
