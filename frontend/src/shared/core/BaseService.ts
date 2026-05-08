import { DomainError, InternalServerError } from './DomainError';
import { Logger } from './Logger';

export abstract class BaseService {
  protected readonly logger: Logger;

  constructor(serviceName: string) {
    this.logger = new Logger(serviceName);
  }

  protected async executeOperation<T>(operationName: string, operation: () => Promise<T>, context?: Record<string, unknown>): Promise<T> {
    const startedAt = performance.now();
    try {
      this.logger.debug(`Starting ${operationName}`, context);
      const result = await operation();
      this.logger.debug(`Completed ${operationName}`, { durationMs: performance.now() - startedAt, ...context });
      return result;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      this.logger.error(`${operationName} failed`, {
        durationMs: performance.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        ...context,
      });
      throw new InternalServerError(`Operation failed: ${operationName}`);
    }
  }
}