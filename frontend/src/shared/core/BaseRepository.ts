import { InternalServerError, NotFoundError } from './DomainError';
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
      this.logger.error(`${operationName} failed`, { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof Error) throw error;
      throw new InternalServerError(`Repository operation failed: ${operationName}`);
    }
  }

  async findByIdOrThrow(id: ID, resourceName = 'Resource'): Promise<T> {
    const entity = await this.findById(id);
    if (!entity) throw new NotFoundError(resourceName, String(id));
    return entity;
  }

  abstract findById(id: ID): Promise<T | null>;
  abstract save(entity: T): Promise<void>;
  abstract delete(id: ID): Promise<void>;
}