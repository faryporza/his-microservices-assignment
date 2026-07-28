import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoicesService } from './invoices.service';
import { ProcessedEvent } from '../messaging/entities/processed-event.entity';

describe('InvoicesService', () => {
  const repository = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<Invoice>>;
  const processedEventRepository = {
    create: jest.fn(),
    exists: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<ProcessedEvent>>;
  const service = new InvoicesService(repository, processedEventRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    processedEventRepository.exists.mockResolvedValue(false);
    repository.findOne.mockResolvedValue(null);
    processedEventRepository.create.mockImplementation(
      (event) => event as ProcessedEvent,
    );
    processedEventRepository.save.mockImplementation(async (event) => event);
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
      service.createFromTreatment('event-id', {
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
    expect(processedEventRepository.save).toHaveBeenCalledWith({
      eventId: 'event-id',
    });
  });

  it('rejects negative or invalid money amounts', async () => {
    await expect(
      service.createFromTreatment('event-id', {
        visitId: 'visit-id',
        totalAmount: '-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createFromTreatment('event-id', {
        visitId: 'visit-id',
        totalAmount: '1.999',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignores an event that was already processed', async () => {
    processedEventRepository.exists.mockResolvedValue(true);

    await expect(
      service.createFromTreatment('event-id', {
        visitId: 'visit-id',
        recordId: 'record-id',
        totalAmount: 1500,
      }),
    ).resolves.toBeNull();

    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('does not create a second primary invoice for the same visit', async () => {
    const existingInvoice = {
      id: 'invoice-id',
      visitId: 'visit-id',
      totalAmount: '1500.00',
      status: InvoiceStatus.PENDING,
    } as Invoice;
    repository.findOne.mockResolvedValue(existingInvoice);

    await expect(
      service.createFromTreatment('another-event-id', {
        visitId: 'visit-id',
        recordId: 'record-id',
        totalAmount: 1500,
      }),
    ).resolves.toBe(existingInvoice);

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(processedEventRepository.save).toHaveBeenCalledWith({
      eventId: 'another-event-id',
    });
  });

  it('returns 404 when an invoice does not exist', async () => {
    await expect(service.findById('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('pays a pending invoice once and records the payment time', async () => {
    const invoice = {
      id: 'invoice-id',
      status: InvoiceStatus.PENDING,
      paidAt: null,
    } as Invoice;
    repository.findOne.mockResolvedValue(invoice);
    repository.save.mockResolvedValue(invoice);

    await expect(service.pay('invoice-id')).resolves.toMatchObject({
      status: InvoiceStatus.PAID,
    });
    expect(invoice.paidAt).toBeInstanceOf(Date);
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
  });
});
