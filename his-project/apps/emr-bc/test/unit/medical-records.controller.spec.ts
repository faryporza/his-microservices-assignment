import { Reflector } from '@nestjs/core';
import { MedicalRecordsController } from '@apps/emr-bc/modules/medical-record/controllers/medical-records.controller';
import { MedicalRecordsService } from '@apps/emr-bc/modules/medical-record/services/medical-records.service';
import { CompleteTreatmentDTO } from '@apps/emr-bc/modules/medical-record/dto/complete-treatment.dto';
import { ROLES_KEY, UserRole } from '@app/common';

describe('MedicalRecordsController', () => {
  const reflector = new Reflector();

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

  it('verifies RBAC role metadata on all medical record endpoints', () => {
    const createRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      MedicalRecordsController.prototype.create,
    );
    expect(createRoles).toEqual([UserRole.ADMIN, UserRole.DOCTOR]);

    const findAllRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      MedicalRecordsController.prototype.findAll,
    );
    expect(findAllRoles).toEqual([
      UserRole.ADMIN,
      UserRole.DOCTOR,
      UserRole.NURSE,
    ]);

    const findOneRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      MedicalRecordsController.prototype.findOne,
    );
    expect(findOneRoles).toEqual([
      UserRole.ADMIN,
      UserRole.DOCTOR,
      UserRole.NURSE,
      UserRole.PATIENT,
    ]);

    const findByVisitIdRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      MedicalRecordsController.prototype.findByVisitId,
    );
    expect(findByVisitIdRoles).toEqual([
      UserRole.ADMIN,
      UserRole.DOCTOR,
      UserRole.NURSE,
      UserRole.PATIENT,
    ]);

    const updateRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      MedicalRecordsController.prototype.update,
    );
    expect(updateRoles).toEqual([UserRole.ADMIN, UserRole.DOCTOR]);

    const completeTreatmentRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      MedicalRecordsController.prototype.completeTreatment,
    );
    expect(completeTreatmentRoles).toEqual([UserRole.ADMIN, UserRole.DOCTOR]);
  });
});
