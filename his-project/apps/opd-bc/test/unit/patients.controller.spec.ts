import { PatientsController } from '@apps/opd-bc/patient/patients.controller';
import { UpdatePatientDTO } from '@apps/opd-bc/patient/dto/update-patient.dto';
import {
  createMockPatient,
  createMockPatientsService,
} from '../mocks/mock-patients';

describe('PatientsController (Unit)', () => {
  const service = createMockPatientsService();
  const controller = new PatientsController(service);
  const patient = createMockPatient();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates patient creation', async () => {
    const dto = {
      hn: 'HN-001',
      first_name: 'Somchai',
      last_name: 'Jaidee',
      id_card: '1101700203456',
    };
    service.create.mockResolvedValue(patient);

    await expect(controller.create(dto)).resolves.toBe(patient);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates reads, update, and delete', async () => {
    service.findAll.mockResolvedValue([patient]);
    service.findOne.mockResolvedValue(patient);
    service.update.mockResolvedValue(patient);
    service.delete.mockResolvedValue(undefined);
    const updateDto: UpdatePatientDTO = { first_name: 'Updated' };

    await expect(controller.findAll()).resolves.toEqual([patient]);
    await expect(controller.findOne(patient.id)).resolves.toBe(patient);
    await expect(controller.update(patient.id, updateDto)).resolves.toBe(
      patient,
    );
    await expect(controller.delete(patient.id)).resolves.toBeUndefined();

    expect(service.findAll).toHaveBeenCalledWith();
    expect(service.findOne).toHaveBeenCalledWith(patient.id);
    expect(service.update).toHaveBeenCalledWith(patient.id, updateDto);
    expect(service.delete).toHaveBeenCalledWith(patient.id);
  });
});
