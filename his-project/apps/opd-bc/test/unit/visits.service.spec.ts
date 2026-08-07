import { NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { OutboxEventsService, IdempotencyService } from '@app/common';
import { Patient } from '@apps/opd-bc/patient/entities/patient.entity';
import { Visit, VisitStatus } from '@apps/opd-bc/visit/entities/visit.entity';
import { VisitsService } from '@apps/opd-bc/visit/visits.service';
import { createMockVisit } from '../mocks/mock-visits';

describe('VisitsService (Unit)', () => {
  const visitRepository = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<Visit>>;
  const patientRepository = {
    findOne: jest.fn(),
  } as unknown as jest.Mocked<Repository<Patient>>;
  const manager = {
    getRepository: jest.fn(),
  } as unknown as jest.Mocked<EntityManager>;
  const outbox = {
    runInTransaction: jest.fn(),
    enqueue: jest.fn(),
    publishPending: jest.fn(),
  } as unknown as jest.Mocked<OutboxEventsService>;
  const idempotency = {} as IdempotencyService;
  let service: VisitsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VisitsService(
      visitRepository,
      patientRepository,
      outbox,
      idempotency,
    );
    outbox.runInTransaction.mockImplementation(async (work) => work(manager));
    outbox.enqueue.mockResolvedValue(undefined);
    outbox.publishPending.mockResolvedValue(undefined);
  });

  it('opens a visit and queues visit.created after persistence', async () => {
    const visit = createMockVisit();
    const patient = visit.patient;
    patientRepository.findOne.mockResolvedValue(patient);
    manager.getRepository
      .mockReturnValueOnce(patientRepository)
      .mockReturnValueOnce(visitRepository);
    visitRepository.create.mockReturnValue(visit);
    visitRepository.save.mockResolvedValue(visit);

    await expect(
      service.create({ patient_id: patient.id }, 'correlation-id', 'trace-id'),
    ).resolves.toBe(visit);

    expect(visit.status).toBe(VisitStatus.OPEN);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      manager,
      'visit.created',
      expect.objectContaining({
        payload: expect.objectContaining({
          visitId: visit.id,
          patientId: patient.id,
        }),
      }),
    );
    expect(outbox.publishPending).toHaveBeenCalledWith();
  });

  it('rejects a visit for an unknown patient', async () => {
    patientRepository.findOne.mockResolvedValue(null);
    manager.getRepository.mockReturnValue(patientRepository);

    await expect(
      service.create({ patient_id: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('reads visits and closes an open visit after payment', async () => {
    const visit = createMockVisit();
    visitRepository.find.mockResolvedValue([visit]);
    visitRepository.findOne.mockResolvedValue(visit);
    visitRepository.save.mockResolvedValue(visit);
    patientRepository.findOne.mockResolvedValue(visit.patient);

    await expect(service.findAll()).resolves.toEqual([visit]);
    await expect(service.findOne(visit.id)).resolves.toBe(visit);
    await expect(service.findByPatientId(visit.patient_id)).resolves.toEqual([
      visit,
    ]);
    await expect(service.closeAfterPayment(visit.id)).resolves.toBe(visit);

    expect(visit.status).toBe(VisitStatus.CLOSED);
    expect(visitRepository.save).toHaveBeenCalledWith(visit);
  });

  it('keeps a closed visit closed and reports missing visits', async () => {
    const visit = createMockVisit();
    visit.status = VisitStatus.CLOSED;
    visitRepository.findOne
      .mockResolvedValueOnce(visit)
      .mockResolvedValueOnce(null);

    await expect(service.closeAfterPayment(visit.id)).resolves.toBe(visit);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
