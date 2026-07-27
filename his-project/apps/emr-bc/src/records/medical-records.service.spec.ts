import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { MedicalRecord, RecordStatus } from './entities/medical-record.entity';
import { MedicalRecordsService } from './medical-records.service';

describe('MedicalRecordsService visit.created handling', () => {
  let service: MedicalRecordsService;
  let repository: jest.Mocked<
    Pick<Repository<MedicalRecord>, 'findOne' | 'create' | 'save'>
  >;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalRecordsService,
        {
          provide: getRepositoryToken(MedicalRecord),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(MedicalRecordsService);
  });

  it('creates a WAITING medical record for a new visit', async () => {
    const visitId = '550e8400-e29b-41d4-a716-446655440000';
    const patientId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
    const newRecord = { visitId, patientId, status: RecordStatus.WAITING };
    const savedRecord = { ...newRecord, id: 'record-id' } as MedicalRecord;

    repository.findOne.mockResolvedValue(null);
    repository.create.mockReturnValue(newRecord as MedicalRecord);
    repository.save.mockResolvedValue(savedRecord);

    await expect(service.createWaitingRecord(visitId, patientId)).resolves.toBe(
      savedRecord,
    );

    expect(repository.findOne).toHaveBeenCalledWith({ where: { visitId } });
    expect(repository.create).toHaveBeenCalledWith({
      visitId,
      patientId,
      status: RecordStatus.WAITING,
    });
    expect(repository.save).toHaveBeenCalledWith(newRecord);
  });

  it('skips creation when the visit already has a medical record', async () => {
    const visitId = '550e8400-e29b-41d4-a716-446655440000';
    const existingRecord = {
      id: 'record-id',
      visitId,
      status: RecordStatus.WAITING,
    } as MedicalRecord;
    repository.findOne.mockResolvedValue(existingRecord);

    await expect(
      service.createWaitingRecord(
        visitId,
        '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      ),
    ).resolves.toBe(existingRecord);

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});
