import { DomainError } from './DomainError';
import { Logger } from './Logger';

export abstract class BaseService {
  protected readonly logger: Logger;

  constructor(serviceName: string) {
    this.logger = new Logger(serviceName);
  }

  protected async executeOperation<T>(operationName: string, operation: () => Promise<T>, context?: Record<string, unknown>): Promise<T> {
    const startedAt = Date.now();
    try {
      this.logger.debug(`Starting ${operationName}`, context);
      const result = await operation();
      this.logger.debug(`Completed ${operationName}`, { durationMs: Date.now() - startedAt, ...context });
      return result;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      this.logger.error(`${operationName} failed`, {
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        ...context,
      });

      throw new DomainError(`Operation failed: ${operationName}`, 'INTERNAL_ERROR', 500);
    }
  }
}