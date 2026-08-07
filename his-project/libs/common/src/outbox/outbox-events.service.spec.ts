import { ClientProxy } from '@nestjs/microservices';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { of, throwError } from 'rxjs';
import { OutboxEvent } from './outbox-event.entity';
import { OutboxEventsService } from './outbox-events.service';

describe('OutboxEventsService', () => {
  const event = {
    metadata: {
      eventId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      eventName: 'visit.created',
      version: '1.0.0',
      occurredAt: '2026-08-05T00:00:00.000Z',
    },
    payload: { visitId: '550e8400-e29b-41d4-a716-446655440000' },
  };

  it('enqueues the complete event envelope in the local transaction', async () => {
    const outboxRepository = {
      create: jest.fn((value: Partial<OutboxEvent>) => value as OutboxEvent),
      save: jest.fn((value: OutboxEvent) => Promise.resolve(value)),
    } as unknown as jest.Mocked<Repository<OutboxEvent>>;
    const manager = {
      getRepository: () => outboxRepository,
    } as unknown as EntityManager;
    const service = new OutboxEventsService(
      {} as DataSource,
      {} as Repository<OutboxEvent>,
      {} as ClientProxy,
    );

    await service.enqueue(manager, event.metadata.eventName, event);

    expect(outboxRepository.create).toHaveBeenCalledWith({
      event_id: event.metadata.eventId,
      event_name: event.metadata.eventName,
      event_data: event,
      occurred_at: new Date(event.metadata.occurredAt),
      published_at: null,
    });
    expect(outboxRepository.save).toHaveBeenCalled();
  });

  it('marks an event published only after RabbitMQ confirms it', async () => {
    const pendingEvent = {
      event_id: event.metadata.eventId,
      event_name: event.metadata.eventName,
      event_data: event,
      occurred_at: new Date(event.metadata.occurredAt),
      published_at: null,
      created_at: new Date(),
    } as OutboxEvent;
    const repository = {
      find: jest.fn().mockResolvedValue([pendingEvent]),
      save: jest.fn().mockResolvedValue(pendingEvent),
    } as unknown as jest.Mocked<Repository<OutboxEvent>>;
    const client = {
      emit: jest.fn().mockReturnValue(of(undefined)),
    } as unknown as jest.Mocked<ClientProxy>;
    const service = new OutboxEventsService(
      {} as DataSource,
      repository,
      client,
    );

    await service.publishPending();

    expect(client.emit).toHaveBeenCalledWith(event.metadata.eventName, event);
    expect(pendingEvent.published_at).toBeInstanceOf(Date);
    expect(repository.save).toHaveBeenCalledWith(pendingEvent);
  });

  it('keeps failed events pending so the next retry can publish them', async () => {
    const pendingEvent = {
      event_id: event.metadata.eventId,
      event_name: event.metadata.eventName,
      event_data: event,
      occurred_at: new Date(event.metadata.occurredAt),
      published_at: null,
      created_at: new Date(),
    } as OutboxEvent;
    const repository = {
      find: jest.fn().mockResolvedValue([pendingEvent]),
      save: jest.fn().mockResolvedValue(pendingEvent),
    } as unknown as jest.Mocked<Repository<OutboxEvent>>;
    const client = {
      emit: jest
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('broker down')))
        .mockReturnValue(of(undefined)),
    } as unknown as jest.Mocked<ClientProxy>;
    const service = new OutboxEventsService(
      {} as DataSource,
      repository,
      client,
    );

    await service.publishPending();
    expect(pendingEvent.published_at).toBeNull();
    expect(repository.save).not.toHaveBeenCalled();

    await service.publishPending();
    expect(pendingEvent.published_at).toBeInstanceOf(Date);
    expect(repository.save).toHaveBeenCalledWith(pendingEvent);
  });

  it('starts and stops the periodic publisher safely', async () => {
    jest.useFakeTimers();
    const service = new OutboxEventsService(
      {} as DataSource,
      {
        find: jest.fn().mockResolvedValue([]),
      } as unknown as Repository<OutboxEvent>,
      {} as ClientProxy,
    );
    const publishPending = jest
      .spyOn(service, 'publishPending')
      .mockResolvedValue(undefined);

    await service.onModuleInit();
    jest.advanceTimersByTime(5000);
    service.onModuleDestroy();

    expect(publishPending).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('does not overlap concurrent publisher runs', async () => {
    let resolveFirst!: () => void;
    const firstRun = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const repository = {
      find: jest.fn().mockReturnValueOnce(firstRun).mockResolvedValueOnce([]),
    } as unknown as jest.Mocked<Repository<OutboxEvent>>;
    const service = new OutboxEventsService(
      {} as DataSource,
      repository,
      {} as ClientProxy,
    );

    const first = service.publishPending();
    await service.publishPending();
    expect(repository.find).toHaveBeenCalledTimes(1);
    resolveFirst();
    await first;
  });

  it('handles a failure while loading pending events', async () => {
    const repository = {
      find: jest.fn().mockRejectedValue(new Error('database unavailable')),
    } as unknown as jest.Mocked<Repository<OutboxEvent>>;
    const service = new OutboxEventsService(
      {} as DataSource,
      repository,
      {} as ClientProxy,
    );

    await expect(service.publishPending()).resolves.toBeUndefined();
  });
});
