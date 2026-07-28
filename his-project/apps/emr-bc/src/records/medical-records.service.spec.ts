import { BadRequestException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import {
  RABBITMQ_ROUTING_KEYS,
  TREATMENT_COMPLETED_EVENT_NAME,
  TREATMENT_COMPLETED_EVENT_VERSION,
  TreatmentCompletedEvent,
} from '@app/contracts';
import { of } from 'rxjs';
import { Repository } from 'typeorm';
import { EMR_RMQ_CLIENT } from '../messaging/emr-rabbitmq.module';
import { MedicalRecord, RecordStatus } from './entities/medical-record.entity';
import { MedicalRecordsService } from './medical-records.service';

describe('MedicalRecordsService', () => {
  let service: MedicalRecordsService;
  let repository: jest.Mocked<
    Pick<Repository<MedicalRecord>, 'create' | 'save' | 'findOne'>
  >;
  let rmqClient: jest.Mocked<Pick<ClientProxy, 'emit'>>;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };
    rmqClient = {
      emit: jest.fn().mockReturnValue(of(undefined)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalRecordsService,
        {
          provide: getRepositoryToken(MedicalRecord),
          useValue: repository,
        },
        {
          provide: EMR_RMQ_CLIENT,
          useValue: rmqClient,
        },
      ],
    }).compile();

    service = module.get(MedicalRecordsService);
  });

  it('persists a completed record before publishing treatment.completed', async () => {
    const createDto = {
      visitId: '550e8400-e29b-41d4-a716-446655440000',
      diagnosis: 'Influenza',
      treatmentNote: 'Rest and hydrate',
      doctorId: 'doctor-1',
      treatmentCost: 1500,
    };
    const newRecord = {
      ...createDto,
      status: RecordStatus.COMPLETED,
    } as MedicalRecord;
    const savedRecord = {
      ...newRecord,
      id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    };
    repository.create.mockReturnValue(newRecord);
    repository.save.mockResolvedValue(savedRecord);

    await expect(service.create(createDto)).resolves.toBe(savedRecord);

    expect(repository.save).toHaveBeenCalledWith(newRecord);
    expect(rmqClient.emit).toHaveBeenCalledTimes(1);
    const [routingKey, event] = rmqClient.emit.mock.calls[0] as [
      string,
      TreatmentCompletedEvent,
    ];
    expect(routingKey).toBe(RABBITMQ_ROUTING_KEYS.treatmentCompleted);
    expect(event.metadata).toEqual(
      expect.objectContaining({
        eventName: TREATMENT_COMPLETED_EVENT_NAME,
        version: TREATMENT_COMPLETED_EVENT_VERSION,
      }),
    );
    expect(event.payload).toEqual({
      visitId: savedRecord.visitId,
      recordId: savedRecord.id,
      treatmentCost: 1500,
    });
    expect(repository.save.mock.invocationCallOrder[0]).toBeLessThan(
      rmqClient.emit.mock.invocationCallOrder[0],
    );
  });

  it('publishes when a waiting record transitions to completed', async () => {
    const waitingRecord = {
      id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      visitId: '550e8400-e29b-41d4-a716-446655440000',
      status: RecordStatus.WAITING,
    } as MedicalRecord;
    repository.findOne.mockResolvedValue(waitingRecord);
    repository.save.mockImplementation(async (record) => record);

    await service.update(waitingRecord.id, {
      diagnosis: 'Influenza',
      treatmentNote: 'Rest and hydrate',
      doctorId: 'doctor-1',
      treatmentCost: 1500,
      status: RecordStatus.COMPLETED,
    });

    expect(rmqClient.emit).toHaveBeenCalledTimes(1);
  });

  it('does not complete or publish without all treatment details', async () => {
    const waitingRecord = {
      id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      visitId: '550e8400-e29b-41d4-a716-446655440000',
      diagnosis: 'Influenza',
      status: RecordStatus.WAITING,
    } as MedicalRecord;
    repository.findOne.mockResolvedValue(waitingRecord);

    await expect(
      service.update(waitingRecord.id, {
        status: RecordStatus.COMPLETED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.save).not.toHaveBeenCalled();
    expect(rmqClient.emit).not.toHaveBeenCalled();
  });

  it('rejects a negative treatment cost without publishing', async () => {
    await expect(
      service.create({
        visitId: '550e8400-e29b-41d4-a716-446655440000',
        diagnosis: 'Influenza',
        treatmentNote: 'Rest and hydrate',
        doctorId: 'doctor-1',
        treatmentCost: -1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.save).not.toHaveBeenCalled();
    expect(rmqClient.emit).not.toHaveBeenCalled();
  });
});
