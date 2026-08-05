import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsService } from './medical-records.service';
import { CompleteTreatmentDTO } from './dto/complete-treatment.dto';

describe('MedicalRecordsController', () => {
  it('keeps the legacy complete route mapped to completeTreatment', async () => {
    const service = {
      completeTreatment: jest.fn().mockResolvedValue({ id: 'record-id' }),
    } as unknown as jest.Mocked<MedicalRecordsService>;
    const controller = new MedicalRecordsController(service);
    const dto: CompleteTreatmentDTO = {
      doctor_id: 'doctor-001',
      diagnosis: 'Flu',
      treatment_note: 'Rest',
      treatment_cost: 1500,
    };

    await expect(
      controller.completeTreatment(
        'record-id',
        dto,
        'visit-correlation',
        'trace-id',
      ),
    ).resolves.toEqual({ id: 'record-id' });

    expect(service.completeTreatment).toHaveBeenCalledWith(
      'record-id',
      dto,
      'visit-correlation',
      'trace-id',
    );
  });

  it('forwards request identifiers when updating a medical record', async () => {
    const service = {
      update: jest.fn().mockResolvedValue({ id: 'record-id' }),
    } as unknown as jest.Mocked<MedicalRecordsService>;
    const controller = new MedicalRecordsController(service);

    await controller.update(
      'record-id',
      { diagnosis: 'Recovered' },
      'request-correlation-id',
      'request-trace-id',
    );

    expect(service.update).toHaveBeenCalledWith(
      'record-id',
      { diagnosis: 'Recovered' },
      'request-correlation-id',
      'request-trace-id',
    );
  });
});
