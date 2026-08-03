import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsService } from './medical-records.service';
import { CompleteTreatmentDto } from './dto/complete-treatment.dto';

describe('MedicalRecordsController', () => {
  it('keeps the legacy complete route mapped to completeTreatment', async () => {
    const service = {
      completeTreatment: jest.fn().mockResolvedValue({ id: 'record-id' }),
    } as unknown as jest.Mocked<MedicalRecordsService>;
    const controller = new MedicalRecordsController(service);
    const dto: CompleteTreatmentDto = {
      doctorId: 'doctor-001',
      diagnosis: 'Flu',
      treatmentNote: 'Rest',
      treatmentCost: 1500,
    };

    await expect(
      controller.completeTreatment('record-id', dto, 'visit-correlation'),
    ).resolves.toEqual({ id: 'record-id' });

    expect(service.completeTreatment).toHaveBeenCalledWith(
      'record-id',
      dto,
      'visit-correlation',
    );
  });
});
