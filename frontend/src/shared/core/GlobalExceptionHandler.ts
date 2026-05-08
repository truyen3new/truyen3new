import { DomainError } from './DomainError';
import { Logger } from './Logger';

export type StandardErrorResponse = {
  error: string;
  code: string;
  requestId: string;
  details?: Record<string, unknown>;
};

const logger = new Logger('GlobalExceptionHandler');

export function createGlobalExceptionHandler<TRequest, TResponse>(
  handler: (request: TRequest) => Promise<TResponse>,
  toResponse: (body: StandardErrorResponse | TResponse, status: number) => TResponse,
  getRequestId: () => string,
) {
  return async (request: TRequest): Promise<TResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      const requestId = getRequestId();

      if (error instanceof DomainError) {
        logger.warn('Domain error', { requestId, code: error.code, message: error.message });
        return toResponse(
          {
            error: error.message,
            code: error.code,
            requestId,
            details: error.details,
          },
          error.httpStatus,
        );
      }

      logger.error('Unhandled error', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      return toResponse(
        {
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          requestId,
        },
        500,
      );
    }
  };
}