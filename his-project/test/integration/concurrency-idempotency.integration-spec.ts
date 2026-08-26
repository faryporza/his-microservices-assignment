import { IdempotencyService } from '@app/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ProcessedEvent } from '@app/common';
import { randomUUID } from 'node:crypto';

describe('Concurrency & Atomic Idempotency (R8)', () => {
  let mockRepository: jest.Mocked<Repository<ProcessedEvent>>;
  let mockManager: jest.Mocked<EntityManager>;
  let mockDataSource: jest.Mocked<DataSource>;
  let service: IdempotencyService;

  beforeEach(() => {
    const claimedEventIds = new Set<string>();
    let currentClaimAffected = 1;
    const queryBuilder = {} as {
      insert: jest.Mock;
      into: jest.Mock;
      values: jest.Mock;
      orIgnore: jest.Mock;
      execute: jest.Mock;
    };
    Object.assign(queryBuilder, {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn((value: { event_id: string }) => {
        const alreadyClaimed = claimedEventIds.has(value.event_id);
        if (!alreadyClaimed) claimedEventIds.add(value.event_id);
        currentClaimAffected = alreadyClaimed ? 0 : 1;
        return queryBuilder;
      }),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ affected: currentClaimAffected }),
        ),
    });
    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
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

  it('atomically detects duplicate executions under concurrent delivery', async () => {
    const businessLogic = jest.fn().mockResolvedValue({ result: 'success' });

    const [res1, res2] = await Promise.all([
      service.process('event-uuid-1', 'visit.created', businessLogic),
      service.process('event-uuid-1', 'visit.created', businessLogic),
    ]);

    expect([res1.isDuplicate, res2.isDuplicate].sort()).toEqual([false, true]);
    expect(businessLogic).toHaveBeenCalledTimes(1);
  });
});

const liveDescribe =
  process.env.RUN_LIVE_INTEGRATION === 'true' ? describe : describe.skip;

liveDescribe('Concurrency & Atomic Idempotency against PostgreSQL (R8)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? '127.0.0.1',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USERNAME ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: process.env.IAM_DATABASE ?? 'iam_db',
      entities: [ProcessedEvent],
      synchronize: false,
      migrationsRun: false,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('executes business logic once for concurrent deliveries on a real database', async () => {
    const eventId = randomUUID();
    const service = new IdempotencyService(dataSource);
    const businessLogic = jest.fn().mockImplementation(async () => {
      // Keep the winning transaction open while the competing transaction
      // attempts the same unique claim.
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { result: 'success' };
    });

    try {
      const [first, second] = await Promise.all([
        service.process(eventId, 'visit.created', businessLogic),
        service.process(eventId, 'visit.created', businessLogic),
      ]);

      expect([first.isDuplicate, second.isDuplicate].sort()).toEqual([
        false,
        true,
      ]);
      expect(businessLogic).toHaveBeenCalledTimes(1);
    } finally {
      await dataSource.getRepository(ProcessedEvent).delete({
        event_id: eventId,
      });
    }
  });
});
