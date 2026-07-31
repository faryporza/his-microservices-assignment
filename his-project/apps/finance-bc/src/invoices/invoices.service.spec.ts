import {
  INVOICE_PAID_EVENT_NAME,
  INVOICE_PAID_EVENT_VERSION,
  InvoicePaidEvent,
  RABBITMQ_ROUTING_KEYS,
} from '@app/contracts';
import { ClientProxy } from '@nestjs/microservices';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { of } from 'rxjs';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  const repository = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<Invoice>>;
  const rmqClient = {
    emit: jest.fn().mockReturnValue(of(undefined)),
  } as unknown as jest.Mocked<ClientProxy>;
  const service = new InvoicesService(repository, rmqClient);

  beforeEach(() => {
    jest.clearAllMocks();
    rmqClient.emit.mockReturnValue(of(undefined));
  });

  it('creates a pending invoice with a two-decimal amount', async () => {
    const invoice = {
      id: 'invoice-id',
      visitId: 'visit-id',
      totalAmount: '1500.00',
      status: InvoiceStatus.PENDING,
    } as Invoice;
    repository.create.mockReturnValue(invoice);
    repository.save.mockResolvedValue(invoice);

    await expect(
      service.createFromTreatment({
        visitId: 'visit-id',
        recordId: 'record-id',
        totalAmount: '1500',
      }),
    ).resolves.toBe(invoice);

    expect(repository.create).toHaveBeenCalledWith({
      visitId: 'visit-id',
      recordId: 'record-id',
      totalAmount: '1500.00',
      status: InvoiceStatus.PENDING,
    });
  });

  it('rejects negative or invalid money amounts', async () => {
    await expect(
      service.createFromTreatment({ visitId: 'visit-id', totalAmount: '-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createFromTreatment({
        visitId: 'visit-id',
        totalAmount: '1.999',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when an invoice does not exist', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.findById('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('pays a pending invoice once and records the payment time', async () => {
    const invoice = {
      id: 'invoice-id',
      visitId: 'visit-id',
      status: InvoiceStatus.PENDING,
      paidAt: null,
    } as Invoice;
    repository.findOne.mockResolvedValue(invoice);
    repository.save.mockResolvedValue(invoice);

    await expect(service.pay('invoice-id')).resolves.toMatchObject({
      status: InvoiceStatus.PAID,
    });
    expect(invoice.paidAt).toBeInstanceOf(Date);
    expect(repository.save).toHaveBeenCalledWith(invoice);
    expect(rmqClient.emit).toHaveBeenCalledTimes(1);

    const [routingKey, event] = rmqClient.emit.mock.calls[0] as [
      string,
      InvoicePaidEvent,
    ];
    expect(routingKey).toBe(RABBITMQ_ROUTING_KEYS.invoicePaid);
    expect(event.metadata).toEqual(
      expect.objectContaining({
        eventName: INVOICE_PAID_EVENT_NAME,
        version: INVOICE_PAID_EVENT_VERSION,
      }),
    );
    expect(event.payload).toEqual({
      visitId: 'visit-id',
      invoiceId: 'invoice-id',
      status: 'PAID',
    });
    expect(repository.save.mock.invocationCallOrder[0]).toBeLessThan(
      rmqClient.emit.mock.invocationCallOrder[0],
    );
  });

  it('does not allow a paid invoice to be paid again', async () => {
    repository.findOne.mockResolvedValue({
      id: 'invoice-id',
      status: InvoiceStatus.PAID,
    } as Invoice);

    await expect(service.pay('invoice-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(rmqClient.emit).not.toHaveBeenCalled();
  });
});
