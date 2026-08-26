import { UserRole, ROLE_PERMISSIONS, PERMISSIONS_KEY } from '@app/common';
import { Reflector } from '@nestjs/core';
import { PatientsController } from '@apps/opd-bc/modules/patient/controllers/patients.controller';
import { VisitsController } from '@apps/opd-bc/modules/visit/controllers/visits.controller';
import { MedicalRecordsController } from '@apps/emr-bc/modules/medical-record/controllers/medical-records.controller';
import { InvoicesController } from '@apps/finance-bc/modules/invoice/controllers/invoices.controller';

describe('RBAC & Documentation Drift Prevention (R17)', () => {
  const reflector = new Reflector();

  it('ensures every UserRole is explicitly defined in ROLE_PERMISSIONS mapping', () => {
    const roles = Object.values(UserRole);
    roles.forEach((role) => {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    });
  });

  it('verifies that all controller permission requirements are covered by active RBAC matrix', () => {
    const controllers = [
      PatientsController,
      VisitsController,
      MedicalRecordsController,
      InvoicesController,
    ];

    const allDefinedPermissions = new Set(
      Object.values(ROLE_PERMISSIONS).flatMap((perms) => perms),
    );

    controllers.forEach((ControllerClass) => {
      const proto = ControllerClass.prototype;
      const methods = Object.getOwnPropertyNames(proto).filter(
        (m) => m !== 'constructor' && typeof proto[m] === 'function',
      );

      methods.forEach((methodName) => {
        const requiredPerms = reflector.get<string[] | undefined>(
          PERMISSIONS_KEY,
          proto[methodName],
        );

        if (requiredPerms && requiredPerms.length > 0) {
          requiredPerms.forEach((perm) => {
            expect(
              allDefinedPermissions.has(perm) || allDefinedPermissions.has('*'),
            ).toBe(true);
          });
        }
      });
    });
  });
});
