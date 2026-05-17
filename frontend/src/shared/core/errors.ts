/**
 * Centralized error types for all services.
 * Extracted to break circular dependency between analytics.service and analytics.api.
 */

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AnalyticsError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super('ANALYTICS_ERROR', message, 500, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('AUTH_ERROR', message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Forbidden') {
    super('AUTHZ_ERROR', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} with id ${id} not found`, 404);
  }
}

/**
 * Safe error extraction for API responses (never leak internal error details).
 */
export function toApiError(err: any): { code: string; message: string; statusCode: number } {
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
    };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred',
    statusCode: 500,
  };
}
