import {
  MedicalRecord,
  RecordStatus,
} from '@apps/emr-bc/medical-record/entities/medical-record.entity';
import { MedicalRecordsService } from '@apps/emr-bc/medical-record/medical-records.service';

export function createMockMedicalRecordsService(): jest.Mocked<MedicalRecordsService> {
  return {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByVisitId: jest.fn(),
    update: jest.fn(),
    processVisitCreated: jest.fn(),
    completeTreatment: jest.fn(),
    createWaitingRecord: jest.fn(),
  } as unknown as jest.Mocked<MedicalRecordsService>;
}

export function createMockMedicalRecord(): MedicalRecord {
  return {
    id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    visit_id: '550e8400-e29b-41d4-a716-446655440000',
    patient_id: '7ba7b810-9dad-41d1-80b4-00c04fd430c8',
    correlation_id: 'correlation-id',
    doctor_id: 'doctor-001',
    diagnosis: 'Flu',
    treatment_note: 'Rest',
    treatment_cost: 1500,
    status: RecordStatus.WAITING,
    created_at: new Date('2026-08-07T00:00:00.000Z'),
    updated_at: new Date('2026-08-07T00:00:00.000Z'),
  };
}
