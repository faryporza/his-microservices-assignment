import { AuditService } from './audit.service';
import { AuditOutcome } from './entities/audit-log.entity';
import { OutboxEventsService } from '../outbox/outbox-events.service';

describe('AuditService', () => {
  let service: AuditService;
  let mockOutbox: jest.Mocked<OutboxEventsService>;

  beforeEach(async () => {
    mockOutbox = {
      runInTransaction: jest
        .fn()
        .mockImplementation(async (work) => work({} as never)),
      enqueue: jest.fn().mockResolvedValue({}),
      publishPending: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OutboxEventsService>;
    service = new AuditService(mockOutbox);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('records an audit log entry for granted access', async () => {
    await service.logAccess({
      actorId: 'user-1',
      actorRole: 'DOCTOR',
      action: 'READ_MEDICAL_RECORD',
      resourceType: 'medical_record',
      resourceId: 'rec-1',
      outcome: AuditOutcome.GRANTED,
    });

    expect(mockOutbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      'access.audit',
      expect.objectContaining({
        payload: expect.objectContaining({
          actorId: 'user-1',
          actorRole: 'DOCTOR',
          action: 'READ_MEDICAL_RECORD',
          resourceType: 'medical_record',
          resourceId: 'rec-1',
          outcome: AuditOutcome.GRANTED,
        }),
      }),
    );
    expect(mockOutbox.publishPending).toHaveBeenCalled();
  });

  it('propagates outbox failure so sensitive data is not served without a durable audit', async () => {
    mockOutbox.runInTransaction.mockRejectedValueOnce(
      new Error('DB connection refused'),
    );

    await expect(
      service.logAccess({
        actorId: 'user-1',
        actorRole: 'DOCTOR',
        action: 'READ_MEDICAL_RECORD',
        resourceType: 'medical_record',
        resourceId: 'rec-1',
        outcome: AuditOutcome.DENIED,
      }),
    ).rejects.toThrow('DB connection refused');
  });
});
