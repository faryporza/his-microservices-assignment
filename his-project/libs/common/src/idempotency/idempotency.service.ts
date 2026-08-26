import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ProcessedEvent } from './processed-event.entity';

export interface IdempotencyResult<T> {
  isDuplicate: boolean;
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
      // Claim the event with the unique event_id constraint before invoking
      // business logic. INSERT ... ON CONFLICT DO NOTHING is atomic across
      // concurrent transactions, so only the winner can perform side effects.
      const claim = await processedEventRepository
        .createQueryBuilder()
        .insert()
        .into(ProcessedEvent)
        .values({ event_id: eventId, event_name: eventName })
        .orIgnore()
        .execute();

      const raw = claim.raw as unknown;
      const directAffected = (claim as unknown as { affected?: unknown })
        .affected;
      const affected =
        typeof directAffected === 'number'
          ? directAffected
          : Array.isArray(raw)
            ? typeof raw[1] === 'number'
              ? raw[1]
              : undefined
            : typeof raw === 'object' && raw !== null
              ? (raw as { rowCount?: unknown }).rowCount
              : undefined;

      if (affected === 0) {
        return { isDuplicate: true };
      }

      const value = await businessLogic(manager);

      return { isDuplicate: false, value };
    });
  }
}
