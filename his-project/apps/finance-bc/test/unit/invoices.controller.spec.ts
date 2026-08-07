import { InvoicesController } from '@apps/finance-bc/invoice/invoices.controller';
import {
  createMockInvoice,
  createMockInvoicesService,
} from '../mocks/mock-invoices';

describe('InvoicesController (Unit)', () => {
  const service = createMockInvoicesService();
  const controller = new InvoicesController(service);
  const invoice = createMockInvoice();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates invoice queries', async () => {
    service.findAll.mockResolvedValue([invoice]);
    service.findByVisitId.mockResolvedValue([invoice]);

    await expect(controller.findAll()).resolves.toEqual([invoice]);
    await expect(controller.findByVisitId(invoice.visit_id)).resolves.toEqual([
      invoice,
    ]);

    expect(service.findAll).toHaveBeenCalledWith();
    expect(service.findByVisitId).toHaveBeenCalledWith(invoice.visit_id);
  });

  it('passes payment body and request tracing identifiers', async () => {
    service.pay.mockResolvedValue({ ...invoice, status: 'PAID' });

    await expect(
      controller.pay(
        invoice.id,
        { status: 'PAID' },
        'correlation-id',
        'trace-id',
      ),
    ).resolves.toMatchObject({ status: 'PAID' });
    expect(service.pay).toHaveBeenCalledWith(
      invoice.id,
      'correlation-id',
      'trace-id',
    );
  });
});
