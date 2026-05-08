import { DomainError } from './DomainError';
import { createErrorResponse } from './http';
import { Logger } from './Logger';

const logger = new Logger('GlobalExceptionHandler');

export function withGlobalExceptionHandling(
  handler: (request: Request) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof DomainError) {
        logger.warn('Domain error', { code: error.code, message: error.message });
        return createErrorResponse(error.message, error.httpStatus, error.details);
      }

      logger.error('Unhandled exception', {
        message: error instanceof Error ? error.message : String(error),
      });

      return createErrorResponse('Internal server error', 500);
    }
  };
}
