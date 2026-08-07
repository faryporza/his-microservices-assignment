import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import {
  IdempotencyService,
  OutboxEvent,
  OutboxEventsService,
} from '@app/common';
import {
  MedicalRecord,
  RecordStatus,
} from '@apps/emr-bc/modules/medical-record/entities/medical-record.entity';
import { MedicalRecordsService } from '@apps/emr-bc/modules/medical-record/services/medical-records.service';
import { createMockMedicalRecord } from '../mocks/mock-medical-records';

describe('MedicalRecordsService (Unit)', () => {
  const repository = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<MedicalRecord>>;
  const manager = {
    getRepository: jest.fn().mockReturnValue(repository),
  } as unknown as jest.Mocked<EntityManager>;
  const outbox = {
    runInTransaction: jest.fn(),
    enqueue: jest.fn(),
    publishPending: jest.fn(),
  } as unknown as jest.Mocked<OutboxEventsService>;
  const idempotency = {
    process: jest.fn(),
  } as unknown as jest.Mocked<IdempotencyService>;
  let service: MedicalRecordsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MedicalRecordsService(repository, outbox, idempotency);
    outbox.runInTransaction.mockImplementation(async (work) => work(manager));
    outbox.enqueue.mockResolvedValue({} as OutboxEvent);
    outbox.publishPending.mockResolvedValue(undefined);
  });

  it('creates a waiting record without publishing treatment', async () => {
    const record = createMockMedicalRecord();
    repository.findOne.mockResolvedValue(null);
    repository.create.mockReturnValue(record);
    repository.save.mockResolvedValue(record);

    await expect(
      service.createWaitingRecord(record.visit_id, record.patient_id),
    ).resolves.toBe(record);

    expect(record.status).toBe(RecordStatus.WAITING);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        visit_id: record.visit_id,
        patient_id: record.patient_id,
        status: RecordStatus.WAITING,
      }),
    );
  });

  it('completes a record and queues treatment.completed', async () => {
    const record = createMockMedicalRecord();
    repository.findOne.mockResolvedValue(record);
    repository.save.mockImplementation(async (value) => value);

    await expect(
      service.completeTreatment(
        record.id,
        {
          doctor_id: 'doctor-001',
          diagnosis: 'Recovered',
          treatment_note: 'Continue rest',
          treatment_cost: 1500,
        },
        'correlation-id',
        'trace-id',
      ),
    ).resolves.toBe(record);

    expect(record.status).toBe(RecordStatus.COMPLETED);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      manager,
      'treatment.completed',
      expect.objectContaining({
        metadata: expect.objectContaining({
          correlationId: 'correlation-id',
          traceId: 'trace-id',
        }),
      }),
    );
    expect(outbox.publishPending).toHaveBeenCalledWith();
  });

  it('does not publish again when an already completed record is updated', async () => {
    const record = createMockMedicalRecord();
    record.status = RecordStatus.COMPLETED;
    repository.findOne.mockResolvedValue(record);
    repository.save.mockResolvedValue(record);

    await service.update(record.id, { diagnosis: 'Updated' });

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('validates missing records and negative costs', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.create({
        visit_id: '550e8400-e29b-41d4-a716-446655440000',
        doctor_id: 'doctor-001',
        diagnosis: 'Flu',
        treatment_cost: -1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
