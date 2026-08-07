import { Visit } from '@apps/opd-bc/visit/entities/visit.entity';
import { VisitsService } from '@apps/opd-bc/visit/visits.service';

export function createMockVisitsService(): jest.Mocked<VisitsService> {
  return {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPatientId: jest.fn(),
    processInvoicePaid: jest.fn(),
    closeAfterPayment: jest.fn(),
  } as unknown as jest.Mocked<VisitsService>;
}

export function createMockVisit(): Visit {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    patient_id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    patient: {
      id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      hn: 'HN-001',
      first_name: 'Somchai',
      last_name: 'Jaidee',
      id_card: '1101700203456',
      visits: [],
      created_at: new Date('2026-08-07T00:00:00.000Z'),
      updated_at: new Date('2026-08-07T00:00:00.000Z'),
    },
    visit_date: new Date('2026-08-07T00:00:00.000Z'),
    status: 'OPEN',
  } as Visit;
}
