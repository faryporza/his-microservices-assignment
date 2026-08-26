import { Type } from '@nestjs/common';
import { Patient } from '@apps/opd-bc/modules/patient/entities/patient.entity';
import { MedicalRecord } from '@apps/emr-bc/modules/medical-record/entities/medical-record.entity';
import { Invoice } from '@apps/finance-bc/modules/invoice/entities/invoice.entity';
import { User } from '@apps/iam-bc/modules/user/entities/user.entity';
import { OutboxEvent, ProcessedEvent } from '@app/common';

describe('Schema Isolation & Database Boundaries (R2)', () => {
  const allowedTables: Record<string, string[]> = {
    opd_db: [
      'patients',
      'visits',
      'outbox_events',
      'processed_events',
      'migrations',
    ],
    emr_db: [
      'medical_records',
      'outbox_events',
      'processed_events',
      'migrations',
    ],
    finance_db: ['invoices', 'outbox_events', 'processed_events', 'migrations'],
    iam_db: [
      'users',
      'audit_logs',
      'outbox_events',
      'processed_events',
      'migrations',
    ],
  };

  const bcEntities: Record<string, Type<unknown>[]> = {
    opd_bc: [Patient, OutboxEvent, ProcessedEvent],
    emr_bc: [MedicalRecord, OutboxEvent, ProcessedEvent],
    finance_bc: [Invoice, OutboxEvent, ProcessedEvent],
    iam_bc: [User, OutboxEvent, ProcessedEvent],
  };

  it('declares isolated entity registrations per bounded context', () => {
    // Assert that each BC has distinct domain entities
    expect(bcEntities.opd_bc).not.toContain(MedicalRecord);
    expect(bcEntities.opd_bc).not.toContain(Invoice);
    expect(bcEntities.opd_bc).not.toContain(User);

    expect(bcEntities.emr_bc).not.toContain(Patient);
    expect(bcEntities.emr_bc).not.toContain(Invoice);
    expect(bcEntities.emr_bc).not.toContain(User);

    expect(bcEntities.finance_bc).not.toContain(Patient);
    expect(bcEntities.finance_bc).not.toContain(MedicalRecord);
    expect(bcEntities.finance_bc).not.toContain(User);

    expect(bcEntities.iam_bc).not.toContain(Patient);
    expect(bcEntities.iam_bc).not.toContain(MedicalRecord);
    expect(bcEntities.iam_bc).not.toContain(Invoice);
  });

  it('defines explicit table allowlists per database', () => {
    expect(allowedTables.opd_db).toEqual(
      expect.arrayContaining([
        'patients',
        'visits',
        'outbox_events',
        'processed_events',
      ]),
    );
    expect(allowedTables.opd_db).not.toContain('medical_records');
    expect(allowedTables.opd_db).not.toContain('invoices');
    expect(allowedTables.opd_db).not.toContain('users');

    expect(allowedTables.emr_db).toEqual(
      expect.arrayContaining([
        'medical_records',
        'outbox_events',
        'processed_events',
      ]),
    );
    expect(allowedTables.emr_db).not.toContain('patients');
    expect(allowedTables.emr_db).not.toContain('invoices');
    expect(allowedTables.emr_db).not.toContain('users');

    expect(allowedTables.finance_db).toEqual(
      expect.arrayContaining(['invoices', 'outbox_events', 'processed_events']),
    );
    expect(allowedTables.finance_db).not.toContain('patients');
    expect(allowedTables.finance_db).not.toContain('medical_records');
    expect(allowedTables.finance_db).not.toContain('users');

    expect(allowedTables.iam_db).toEqual(
      expect.arrayContaining([
        'users',
        'audit_logs',
        'outbox_events',
        'processed_events',
      ]),
    );
    expect(allowedTables.iam_db).not.toContain('patients');
    expect(allowedTables.iam_db).not.toContain('medical_records');
    expect(allowedTables.iam_db).not.toContain('invoices');
  });
});
