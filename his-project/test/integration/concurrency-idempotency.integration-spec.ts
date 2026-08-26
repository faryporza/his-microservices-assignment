import { IdempotencyService } from '@app/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ProcessedEvent } from '@app/common';

describe('Concurrency & Atomic Idempotency (R8)', () => {
  let mockRepository: jest.Mocked<Repository<ProcessedEvent>>;
  let mockManager: jest.Mocked<EntityManager>;
  let mockDataSource: jest.Mocked<DataSource>;
  let service: IdempotencyService;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn().mockImplementation((dto: ProcessedEvent) => dto),
      save: jest
        .fn()
        .mockImplementation((entity: ProcessedEvent) =>
          Promise.resolve(entity),
        ),
      exists: jest.fn(),
    } as unknown as jest.Mocked<Repository<ProcessedEvent>>;

    mockManager = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    } as unknown as jest.Mocked<EntityManager>;

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation((work: (m: EntityManager) => Promise<unknown>) =>
          work(mockManager),
        ),
    } as unknown as jest.Mocked<DataSource>;

    service = new IdempotencyService(mockDataSource);
  });

  it('atomically detects duplicate executions and safely skips side effects', async () => {
    mockRepository.exists.mockResolvedValueOnce(false).mockResolvedValue(true);

    const businessLogic = jest.fn().mockResolvedValue({ result: 'success' });

    // First call processes
    const res1 = await service.process(
      'event-uuid-1',
      'visit.created',
      businessLogic,
    );
    expect(res1.isDuplicate).toBe(false);
    expect(businessLogic).toHaveBeenCalledTimes(1);

    // Second duplicate call skips
    const res2 = await service.process(
      'event-uuid-1',
      'visit.created',
      businessLogic,
    );
    expect(res2.isDuplicate).toBe(true);
    expect(businessLogic).toHaveBeenCalledTimes(1); // Not called again
  });
});
