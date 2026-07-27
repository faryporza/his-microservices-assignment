import { NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { Repository } from 'typeorm';
import {
  RABBITMQ_ROUTING_KEYS,
  VISIT_CREATED_EVENT_NAME,
  VISIT_CREATED_EVENT_VERSION,
  VisitCreatedEvent,
} from '@app/contracts';
import { Patient } from '../patients/entities/patient.entity';
import { RMQ_CLIENT } from '../messaging/opd-rabbitmq.module';
import { Visit, VisitStatus } from './entities/visit.entity';
import { VisitsService } from './visits.service';

describe('VisitsService', () => {
  let service: VisitsService;
  let visitRepository: jest.Mocked<Pick<Repository<Visit>, 'create' | 'save'>>;
  let patientRepository: jest.Mocked<Pick<Repository<Patient>, 'findOne'>>;
  let rmqClient: jest.Mocked<Pick<ClientProxy, 'emit'>>;

  beforeEach(async () => {
    visitRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };
    patientRepository = {
      findOne: jest.fn(),
    };
    rmqClient = {
      emit: jest.fn().mockReturnValue(of(undefined)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitsService,
        {
          provide: getRepositoryToken(Visit),
          useValue: visitRepository,
        },
        {
          provide: getRepositoryToken(Patient),
          useValue: patientRepository,
        },
        {
          provide: RMQ_CLIENT,
          useValue: rmqClient,
        },
      ],
    }).compile();

    service = module.get(VisitsService);
  });

  it('persists an OPEN visit before publishing visit.created', async () => {
    const patientId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
    const visitId = '550e8400-e29b-41d4-a716-446655440000';
    const visitDate = new Date('2026-07-28T08:30:00.000Z');
    const patient = { id: patientId } as Patient;
    const newVisit = { patientId, status: VisitStatus.OPEN } as Visit;
    const savedVisit = {
      ...newVisit,
      id: visitId,
      visitDate,
    };

    patientRepository.findOne.mockResolvedValue(patient);
    visitRepository.create.mockReturnValue(newVisit);
    visitRepository.save.mockResolvedValue(savedVisit);

    await expect(service.create({ patientId })).resolves.toBe(savedVisit);

    expect(patientRepository.findOne).toHaveBeenCalledWith({
      where: { id: patientId },
    });
    expect(visitRepository.create).toHaveBeenCalledWith({
      patientId,
      status: VisitStatus.OPEN,
    });
    expect(visitRepository.save).toHaveBeenCalledWith(newVisit);
    expect(rmqClient.emit).toHaveBeenCalledTimes(1);

    const [routingKey, event] = rmqClient.emit.mock.calls[0] as [
      string,
      VisitCreatedEvent,
    ];
    expect(routingKey).toBe(RABBITMQ_ROUTING_KEYS.visitCreated);
    expect(event.metadata.eventName).toBe(VISIT_CREATED_EVENT_NAME);
    expect(event.metadata.version).toBe(VISIT_CREATED_EVENT_VERSION);
    expect(typeof event.metadata.eventId).toBe('string');
    expect(typeof event.metadata.occurredAt).toBe('string');
    expect(event.payload).toEqual({
      visitId,
      patientId,
      timestamp: visitDate.toISOString(),
    });
    expect(visitRepository.save.mock.invocationCallOrder[0]).toBeLessThan(
      rmqClient.emit.mock.invocationCallOrder[0],
    );
  });

  it('does not persist or publish when the patient does not exist', async () => {
    const patientId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
    patientRepository.findOne.mockResolvedValue(null);

    await expect(service.create({ patientId })).rejects.toThrow(
      new NotFoundException(`Patient with ID '${patientId}' not found`),
    );

    expect(visitRepository.create).not.toHaveBeenCalled();
    expect(visitRepository.save).not.toHaveBeenCalled();
    expect(rmqClient.emit).not.toHaveBeenCalled();
  });
});
