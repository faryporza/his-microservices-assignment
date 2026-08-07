import { Patient } from '@apps/opd-bc/modules/patient/entities/patient.entity';
import { PatientsService } from '@apps/opd-bc/modules/patient/services/patients.service';

export function createMockPatientsService(): jest.Mocked<PatientsService> {
  return {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<PatientsService>;
}

export function createMockPatient(): Patient {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    hn: 'HN-001',
    first_name: 'Somchai',
    last_name: 'Jaidee',
    id_card: '1101700203456',
    visits: [],
    created_at: new Date('2026-08-07T00:00:00.000Z'),
    updated_at: new Date('2026-08-07T00:00:00.000Z'),
  };
}
