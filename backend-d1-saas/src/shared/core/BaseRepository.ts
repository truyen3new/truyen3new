import { DomainError } from './DomainError';
import { Logger } from './Logger';

export abstract class BaseRepository<T, ID> {
  protected readonly logger: Logger;

  constructor(repositoryName: string) {
    this.logger = new Logger(`Repository:${repositoryName}`);
  }

  protected async execute<R>(operationName: string, operation: () => Promise<R>): Promise<R> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error(`${operationName} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof DomainError) {
        throw error;
      }

      throw new DomainError(`Repository operation failed: ${operationName}`, 'INTERNAL_ERROR', 500);
    }
  }

  async findByIdOrThrow(id: ID, resourceName = 'Resource'): Promise<T> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new DomainError(`${resourceName} with ID ${String(id)} not found`, 'NOT_FOUND', 404, {
        resource: resourceName,
        id: String(id),
      });
    }

    return entity;
  }

  abstract findById(id: ID): Promise<T | null>;
  abstract save(entity: T): Promise<void>;
  abstract delete(id: ID): Promise<void>;
}