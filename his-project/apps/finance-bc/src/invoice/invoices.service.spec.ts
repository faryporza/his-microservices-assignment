import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { IdempotencyService } from '@app/common';
import { of } from 'rxjs';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  const repository = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<Invoice>>;
  const client = {
    emit: jest.fn(),
  } as unknown as jest.Mocked<ClientProxy>;
  const idempotency = {} as IdempotencyService;
  const service = new InvoicesService(repository, client, idempotency);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findOne.mockReset();
    client.emit.mockReturnValue(of(undefined));
  });

  it('creates a pending invoice with a two-decimal amount', async () => {
    const invoice = {
      id: 'invoice-id',
      visit_id: 'visit-id',
      total_amount: '1500.00',
      status: InvoiceStatus.PENDING,
    } as Invoice;
    repository.create.mockReturnValue(invoice);
    repository.save.mockResolvedValue(invoice);

    await expect(
      service.createFromTreatment({
        visit_id: 'visit-id',
        record_id: 'record-id',
        total_amount: '1500',
      }),
    ).resolves.toBe(invoice);

    expect(repository.create).toHaveBeenCalledWith({
      visit_id: 'visit-id',
      record_id: 'record-id',
      total_amount: '1500.00',
      status: InvoiceStatus.PENDING,
    });
  });

  it('rejects negative or invalid money amounts', async () => {
    await expect(
      service.createFromTreatment({ visit_id: 'visit-id', total_amount: '-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createFromTreatment({
        visit_id: 'visit-id',
        total_amount: '1.999',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when an invoice does not exist', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.findById('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns 404 when a visit has no invoice', async () => {
    repository.find.mockResolvedValue([]);

    await expect(
      service.findByVisitId('missing-visit-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pays a pending invoice once and records the payment time', async () => {
    const invoice = {
      id: 'invoice-id',
      visit_id: 'visit-id',
      correlation_id: 'visit-correlation-id',
      status: InvoiceStatus.PENDING,
      paid_at: null,
    } as Invoice;
    repository.findOne.mockResolvedValue(invoice);
    repository.save.mockResolvedValue(invoice);

    await expect(
      service.pay('invoice-id', 'payment-request-correlation-id'),
    ).resolves.toMatchObject({ status: InvoiceStatus.PAID });
    expect(invoice.paid_at).toBeInstanceOf(Date);
    expect(client.emit).toHaveBeenCalledWith(
      'invoice.paid',
      expect.objectContaining({
        payload: expect.objectContaining({
          visitId: 'visit-id',
          invoiceId: 'invoice-id',
          status: 'PAID',
        }),
        metadata: expect.objectContaining({
          correlationId: 'visit-correlation-id',
        }),
      }),
    );
  });

  it('does not allow a paid invoice to be paid again', async () => {
    repository.findOne.mockResolvedValue({
      id: 'invoice-id',
      visit_id: 'visit-id',
      status: InvoiceStatus.PAID,
    } as Invoice);

    await expect(service.pay('invoice-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(client.emit).not.toHaveBeenCalled();
  });
});
