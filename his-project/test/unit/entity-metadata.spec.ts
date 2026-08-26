import { Patient } from '@apps/opd-bc/modules/patient/entities/patient.entity';
import { Visit } from '@apps/opd-bc/modules/visit/entities/visit.entity';
import { MedicalRecord } from '@apps/emr-bc/modules/medical-record/entities/medical-record.entity';
import { Invoice } from '@apps/finance-bc/modules/invoice/entities/invoice.entity';
import { User } from '@apps/iam-bc/modules/user/entities/user.entity';

describe('Entity Standards & Metadata Blueprint Conformance (R11)', () => {
  const domainEntities = [Patient, Visit, MedicalRecord, Invoice, User];

  domainEntities.forEach((EntityClass) => {
    it(`${EntityClass.name} conforms to standard entity properties and timestamp conventions`, () => {
      const instance = new EntityClass();

      // Verify snake_case property naming
      const properties = Object.getOwnPropertyNames(instance);
      properties.forEach((prop) => {
        expect(prop).toMatch(/^[a-z0-9_]+$/);
      });
    });
  });

  it('verifies that domain entities declare created_at and updated_at audit columns', () => {
    domainEntities.forEach((EntityClass) => {
      const instance = new EntityClass();
      expect(
        'created_at' in instance || 'created_at' in EntityClass.prototype,
      ).toBe(true);
      expect(
        'updated_at' in instance || 'updated_at' in EntityClass.prototype,
      ).toBe(true);
    });
  });
});
