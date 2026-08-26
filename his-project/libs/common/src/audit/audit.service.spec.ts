import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog, AuditOutcome } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let mockAuditRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    mockAuditRepository = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditRepository,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
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

    expect(mockAuditRepository.create).toHaveBeenCalledWith({
      actor_id: 'user-1',
      actor_role: 'DOCTOR',
      action: 'READ_MEDICAL_RECORD',
      resource_type: 'medical_record',
      resource_id: 'rec-1',
      ip_address: null,
      outcome: AuditOutcome.GRANTED,
      metadata: null,
    });
    expect(mockAuditRepository.save).toHaveBeenCalled();
  });

  it('handles database write failure safely without throwing', async () => {
    mockAuditRepository.save.mockRejectedValueOnce(
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
    ).resolves.not.toThrow();
  });
});
