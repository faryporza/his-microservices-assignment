import { PatientsController } from '@apps/opd-bc/modules/patient/controllers/patients.controller';
import { VisitsController } from '@apps/opd-bc/modules/visit/controllers/visits.controller';
import { MedicalRecordsController } from '@apps/emr-bc/modules/medical-record/controllers/medical-records.controller';
import { InvoicesController } from '@apps/finance-bc/modules/invoice/controllers/invoices.controller';
import { UsersController } from '@apps/iam-bc/modules/user/controllers/users.controller';
import { AuthController } from '@apps/iam-bc/modules/auth/controllers/auth.controller';
import { PERMISSIONS_KEY } from '@app/common';
import { Reflector } from '@nestjs/core';

describe('Controller Metadata & Blueprint Decorator Conformance (R12)', () => {
  const reflector = new Reflector();
  const controllers = [
    PatientsController,
    VisitsController,
    MedicalRecordsController,
    InvoicesController,
    UsersController,
    AuthController,
  ];

  it('verifies all controllers are defined and have valid endpoints', () => {
    controllers.forEach((ControllerClass) => {
      expect(ControllerClass).toBeDefined();
      const methods = Object.getOwnPropertyNames(
        ControllerClass.prototype,
      ).filter((m) => m !== 'constructor');
      expect(methods.length).toBeGreaterThan(0);
    });
  });

  it('verifies permission decorators on protected domain operations', () => {
    const patientsCreatePerm = reflector.get(
      PERMISSIONS_KEY,
      PatientsController.prototype.create,
    );
    expect(patientsCreatePerm).toContain('patient:create');

    const visitsCreatePerm = reflector.get(
      PERMISSIONS_KEY,
      VisitsController.prototype.create,
    );
    expect(visitsCreatePerm).toContain('visit:create');

    const recordsCreatePerm = reflector.get(
      PERMISSIONS_KEY,
      MedicalRecordsController.prototype.create,
    );
    expect(recordsCreatePerm).toContain('medical-record:create');

    const invoicesPayPerm = reflector.get(
      PERMISSIONS_KEY,
      InvoicesController.prototype.pay,
    );
    expect(invoicesPayPerm).toContain('invoice:pay');
  });
});
