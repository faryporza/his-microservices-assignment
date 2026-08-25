import { Reflector } from '@nestjs/core';
import { VisitsController } from '@apps/opd-bc/modules/visit/controllers/visits.controller';
import { ROLES_KEY, UserRole } from '@app/common';
import { createMockVisit, createMockVisitsService } from '../mocks/mock-visits';

describe('VisitsController (Unit)', () => {
  const reflector = new Reflector();
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

  it('verifies RBAC role metadata on all visit endpoints', () => {
    const createRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      VisitsController.prototype.create,
    );
    expect(createRoles).toEqual([UserRole.ADMIN, UserRole.NURSE]);

    const findAllRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      VisitsController.prototype.findAll,
    );
    expect(findAllRoles).toEqual([
      UserRole.ADMIN,
      UserRole.DOCTOR,
      UserRole.NURSE,
    ]);

    const findOneRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      VisitsController.prototype.findOne,
    );
    expect(findOneRoles).toEqual([
      UserRole.ADMIN,
      UserRole.DOCTOR,
      UserRole.NURSE,
      UserRole.PATIENT,
    ]);

    const findByPatientIdRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      VisitsController.prototype.findByPatientId,
    );
    expect(findByPatientIdRoles).toEqual([
      UserRole.ADMIN,
      UserRole.DOCTOR,
      UserRole.NURSE,
      UserRole.PATIENT,
    ]);
  });
});
