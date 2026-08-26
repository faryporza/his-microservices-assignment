import { DataSource, EntityManager, Repository } from 'typeorm';
import { IdempotencyService } from './idempotency.service';
import { ProcessedEvent } from './processed-event.entity';

describe('IdempotencyService', () => {
  const repository = {
    createQueryBuilder: jest.fn(),
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
    const queryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    repository.createQueryBuilder.mockReturnValue(queryBuilder);
  });

  it('skips business logic when eventId was already processed', async () => {
    const queryBuilder = repository.createQueryBuilder();
    queryBuilder.execute.mockResolvedValue({ affected: 0 });
    const businessLogic = jest.fn();

    await expect(
      service.process('event-id', 'invoice.paid', businessLogic),
    ).resolves.toEqual({ isDuplicate: true });

    expect(businessLogic).not.toHaveBeenCalled();
    expect(queryBuilder.execute).toHaveBeenCalled();
  });

  it('commits business logic and event marker in one transaction', async () => {
    const businessLogic = jest.fn().mockResolvedValue('done');

    await expect(
      service.process('event-id', 'invoice.paid', businessLogic),
    ).resolves.toEqual({ isDuplicate: false, value: 'done' });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(businessLogic).toHaveBeenCalledWith(manager);
    expect(repository.createQueryBuilder).toHaveBeenCalled();
  });

  it('does not record an event when business logic fails', async () => {
    const error = new Error('database unavailable');

    await expect(
      service.process('event-id', 'invoice.paid', async () => {
        throw error;
      }),
    ).rejects.toThrow(error);

    expect(repository.createQueryBuilder).toHaveBeenCalled();
  });
});
