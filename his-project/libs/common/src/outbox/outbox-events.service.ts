import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { OutboxEvent } from './outbox-event.entity';
import { StructuredLogger } from '../logging/structured.logger';
import { rmqClient } from '../rmq/rmq.constants';

export interface OutboxEventEnvelope {
  metadata: {
    eventId: string;
    eventName: string;
    occurredAt: string;
    version?: string;
    correlationId?: string;
    traceId?: string;
  };
  payload: unknown;
}

@Injectable()
export class OutboxEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new StructuredLogger('shared');
  private publishTimer?: NodeJS.Timeout;
  private isPublishing = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OutboxEvent)
    private readonly repository: Repository<OutboxEvent>,
    @Inject(rmqClient)
    private readonly client: ClientProxy,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.publishPending();
    this.publishTimer = setInterval(() => {
      void this.publishPending();
    }, 5_000);
    this.publishTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.publishTimer) {
      clearInterval(this.publishTimer);
    }
  }

  runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(work);
  }

  async enqueue(
    manager: EntityManager,
    eventName: string,
    event: OutboxEventEnvelope,
  ): Promise<OutboxEvent> {
    const outboxRepository = manager.getRepository(OutboxEvent);
    const outboxEvent = outboxRepository.create({
      event_id: event.metadata.eventId,
      event_name: eventName,
      event_data: event as unknown as Record<string, unknown>,
      occurred_at: new Date(event.metadata.occurredAt),
      published_at: null,
    });
    return outboxRepository.save(outboxEvent);
  }

  async publishPending(): Promise<void> {
    if (this.isPublishing) {
      return;
    }

    this.isPublishing = true;
    try {
      const pendingEvents = await this.repository.find({
        where: { published_at: IsNull() },
        order: { created_at: 'ASC' },
        take: 100,
      });

      for (const outboxEvent of pendingEvents) {
        try {
          await firstValueFrom(
            this.client.emit(outboxEvent.event_name, outboxEvent.event_data),
          );
          outboxEvent.published_at = new Date();
          await this.repository.save(outboxEvent);
        } catch (error: unknown) {
          this.logger.error({
            message: 'Failed to publish outbox event',
            context: {
              action: 'PUBLISH_OUTBOX_EVENT',
              event_id: outboxEvent.event_id,
              event_name: outboxEvent.event_name,
            },
            error,
          });
          // Preserve ordering and leave this row pending for the next retry.
          break;
        }
      }
    } catch (error: unknown) {
      this.logger.error({
        message: 'Failed to load pending outbox events',
        context: { action: 'LOAD_OUTBOX_EVENTS' },
        error,
      });
    } finally {
      this.isPublishing = false;
    }
  }
}
