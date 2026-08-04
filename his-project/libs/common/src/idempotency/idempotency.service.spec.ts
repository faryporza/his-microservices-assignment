import { DataSource, EntityManager, Repository } from 'typeorm';
import { IdempotencyService } from './idempotency.service';
import { ProcessedEvent } from './processed-event.entity';

describe('IdempotencyService', () => {
  const repository = {
    create: jest.fn(),
    exists: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<ProcessedEvent>>;
  const manager = {
    getRepository: jest.fn().mockReturnValue(repository),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn(async (work: (value: EntityManager) => unknown) =>
      work(manager),
    ),
  } as unknown as jest.Mocked<DataSource>;
  const service = new IdempotencyService(dataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.create.mockImplementation((value) => value as ProcessedEvent);
    repository.save.mockImplementation(async (value) => value);
  });

  it('skips business logic when eventId was already processed', async () => {
    repository.exists.mockResolvedValue(true);
    const businessLogic = jest.fn();

    await expect(
      service.process('event-id', 'invoice.paid', businessLogic),
    ).resolves.toEqual({ isDuplicate: true });

    expect(businessLogic).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('commits business logic and event marker in one transaction', async () => {
    repository.exists.mockResolvedValue(false);
    const businessLogic = jest.fn().mockResolvedValue('done');

    await expect(
      service.process('event-id', 'invoice.paid', businessLogic),
    ).resolves.toEqual({ isDuplicate: false, value: 'done' });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(businessLogic).toHaveBeenCalledWith(manager);
    expect(repository.save).toHaveBeenCalledWith({
      event_id: 'event-id',
      event_name: 'invoice.paid',
    });
    expect(businessLogic.mock.invocationCallOrder[0]).toBeLessThan(
      repository.save.mock.invocationCallOrder[0],
    );
  });

  it('does not record an event when business logic fails', async () => {
    repository.exists.mockResolvedValue(false);
    const error = new Error('database unavailable');

    await expect(
      service.process('event-id', 'invoice.paid', async () => {
        throw error;
      }),
    ).rejects.toThrow(error);

    expect(repository.save).not.toHaveBeenCalled();
  });
});
