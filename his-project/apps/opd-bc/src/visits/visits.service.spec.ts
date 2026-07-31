import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { Visit, VisitStatus } from './entities/visit.entity';
import { VisitsService } from './visits.service';

describe('VisitsService', () => {
  const visitRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<Visit>>;
  const patientRepository = {} as jest.Mocked<Repository<Patient>>;
  const service = new VisitsService(visitRepository, patientRepository);

  beforeEach(() => jest.clearAllMocks());

  it('closes an open visit after its invoice is paid', async () => {
    const visit = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: VisitStatus.OPEN,
    } as Visit;
    visitRepository.findOne.mockResolvedValue(visit);
    visitRepository.save.mockImplementation(async (entity) => entity);

    await expect(service.closeAfterPayment(visit.id)).resolves.toMatchObject({
      status: VisitStatus.CLOSED,
    });

    expect(visitRepository.findOne).toHaveBeenCalledWith({
      where: { id: visit.id },
    });
    expect(visitRepository.save).toHaveBeenCalledWith(visit);
  });

  it('leaves an already closed visit unchanged for duplicate events', async () => {
    const visit = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: VisitStatus.CLOSED,
    } as Visit;
    visitRepository.findOne.mockResolvedValue(visit);

    await expect(service.closeAfterPayment(visit.id)).resolves.toBe(visit);

    expect(visitRepository.save).not.toHaveBeenCalled();
  });

  it('returns 404 when the visit does not exist', async () => {
    visitRepository.findOne.mockResolvedValue(null);

    await expect(
      service.closeAfterPayment('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(visitRepository.save).not.toHaveBeenCalled();
  });
});
