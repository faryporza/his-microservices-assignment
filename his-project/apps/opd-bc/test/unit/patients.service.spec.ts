import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository, DeleteResult } from 'typeorm';
import { PatientsService } from '@apps/opd-bc/modules/patient/services/patients.service';
import { Patient } from '@apps/opd-bc/modules/patient/entities/patient.entity';
import { createMockPatient } from '../mocks/mock-patients';

describe('PatientsService (Unit)', () => {
  const repository = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<Repository<Patient>>;
  let service: PatientsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PatientsService(repository);
  });

  it('creates a patient after checking both unique identifiers', async () => {
    const patient = createMockPatient();
    repository.findOne.mockResolvedValue(null);
    repository.create.mockReturnValue(patient);
    repository.save.mockResolvedValue(patient);

    await expect(
      service.create({
        hn: patient.hn,
        first_name: patient.first_name,
        last_name: patient.last_name,
        id_card: patient.id_card,
      }),
    ).resolves.toBe(patient);

    expect(repository.findOne).toHaveBeenCalledTimes(2);
    expect(repository.save).toHaveBeenCalledWith(patient);
  });

  it('rejects duplicate HN and ID card', async () => {
    const patient = createMockPatient();
    repository.findOne.mockResolvedValueOnce(patient);
    await expect(
      service.create({
        hn: patient.hn,
        first_name: patient.first_name,
        last_name: patient.last_name,
        id_card: patient.id_card,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    repository.findOne.mockReset();
    repository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(patient);
    await expect(
      service.create({
        hn: 'HN-002',
        first_name: patient.first_name,
        last_name: patient.last_name,
        id_card: patient.id_card,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps database uniqueness errors to conflicts', async () => {
    const patient = createMockPatient();
    repository.findOne.mockResolvedValue(null);
    repository.create.mockReturnValue(patient);
    repository.save.mockRejectedValue({ code: '23505' });

    await expect(
      service.create({
        hn: patient.hn,
        first_name: patient.first_name,
        last_name: patient.last_name,
        id_card: patient.id_card,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    repository.save.mockRejectedValue(new Error('database unavailable'));
    await expect(
      service.create({
        hn: patient.hn,
        first_name: patient.first_name,
        last_name: patient.last_name,
        id_card: patient.id_card,
      }),
    ).rejects.toThrow('database unavailable');
  });

  it('rejects duplicate identifiers and maps update save conflicts', async () => {
    const patient = createMockPatient();
    repository.findOne
      .mockResolvedValueOnce(patient)
      .mockResolvedValueOnce(patient);
    await expect(
      service.update(patient.id, { hn: 'HN-002' }),
    ).rejects.toBeInstanceOf(ConflictException);

    repository.findOne.mockReset();
    repository.findOne
      .mockResolvedValueOnce(patient)
      .mockResolvedValueOnce(patient);
    await expect(
      service.update(patient.id, { id_card: '2201700203456' }),
    ).rejects.toBeInstanceOf(ConflictException);

    repository.findOne.mockReset();
    repository.findOne.mockResolvedValue(patient);
    repository.save.mockRejectedValue({ code: '23505' });
    await expect(
      service.update(patient.id, { first_name: 'Updated' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('finds, updates, and deletes patients', async () => {
    const patient = createMockPatient();
    repository.find.mockResolvedValue([patient]);
    repository.findOne.mockResolvedValue(patient);
    repository.save.mockResolvedValue(patient);
    repository.delete.mockResolvedValue({ affected: 1 } as DeleteResult);

    await expect(service.findAll()).resolves.toEqual([patient]);
    await expect(service.findOne(patient.id)).resolves.toBe(patient);
    await expect(
      service.update(patient.id, { first_name: 'Updated' }),
    ).resolves.toBe(patient);
    await expect(service.delete(patient.id)).resolves.toBeUndefined();
  });

  it('returns not found when reading or deleting an unknown patient', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.delete.mockResolvedValue({ affected: 0 } as DeleteResult);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.delete('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
