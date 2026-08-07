import { Invoice } from '@apps/finance-bc/modules/invoice/entities/invoice.entity';
import { InvoicesService } from '@apps/finance-bc/modules/invoice/services/invoices.service';

export function createMockInvoicesService(): jest.Mocked<InvoicesService> {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByVisitId: jest.fn(),
    pay: jest.fn(),
    processTreatmentCompleted: jest.fn(),
    createFromTreatment: jest.fn(),
  } as unknown as jest.Mocked<InvoicesService>;
}

export function createMockInvoice(): Invoice {
  return {
    id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    visit_id: '550e8400-e29b-41d4-a716-446655440000',
    record_id: '7ba7b810-9dad-41d1-80b4-00c04fd430c8',
    correlation_id: 'correlation-id',
    total_amount: '1500.00',
    status: 'PENDING',
    paid_at: null,
    created_at: new Date('2026-08-07T00:00:00.000Z'),
    updated_at: new Date('2026-08-07T00:00:00.000Z'),
  } as Invoice;
}
