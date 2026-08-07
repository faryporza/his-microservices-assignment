import { VisitsController } from '@apps/opd-bc/visit/visits.controller';
import { createMockVisit, createMockVisitsService } from '../mocks/mock-visits';

describe('VisitsController (Unit)', () => {
  const service = createMockVisitsService();
  const controller = new VisitsController(service);
  const visit = createMockVisit();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes request tracing identifiers when creating a visit', async () => {
    service.create.mockResolvedValue(visit);
    const dto = { patient_id: visit.patient_id };

    await expect(
      controller.create(dto, 'correlation-id', 'trace-id'),
    ).resolves.toBe(visit);
    expect(service.create).toHaveBeenCalledWith(
      dto,
      'correlation-id',
      'trace-id',
    );
  });

  it('delegates visit queries', async () => {
    service.findAll.mockResolvedValue([visit]);
    service.findOne.mockResolvedValue(visit);
    service.findByPatientId.mockResolvedValue([visit]);

    await expect(controller.findAll()).resolves.toEqual([visit]);
    await expect(controller.findOne(visit.id)).resolves.toBe(visit);
    await expect(controller.findByPatientId(visit.patient_id)).resolves.toEqual(
      [visit],
    );

    expect(service.findAll).toHaveBeenCalledWith();
    expect(service.findOne).toHaveBeenCalledWith(visit.id);
    expect(service.findByPatientId).toHaveBeenCalledWith(visit.patient_id);
  });
});
