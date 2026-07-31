import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ProcessedEvent } from './processed-event.entity';

export interface IdempotencyResult<T> {
  duplicate: boolean;
  value?: T;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly dataSource: DataSource) {}

  async process<T>(
    eventId: string,
    eventName: string,
    businessLogic: (manager: EntityManager) => Promise<T>,
  ): Promise<IdempotencyResult<T>> {
    return this.dataSource.transaction(async (manager) => {
      const processedEventRepository = manager.getRepository(ProcessedEvent);
      const wasProcessed = await processedEventRepository.exists({
        where: { eventId },
      });

      if (wasProcessed) {
        return { duplicate: true };
      }

      const value = await businessLogic(manager);
      const processedEvent = processedEventRepository.create({
        eventId,
        eventName,
      });
      await processedEventRepository.save(processedEvent);

      return { duplicate: false, value };
    });
  }
}
