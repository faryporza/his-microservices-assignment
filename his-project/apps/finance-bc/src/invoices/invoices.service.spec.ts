import { BadRequestException, NotFoundException } from '@nestjs/common';
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
  const service = new InvoicesService(repository);

  beforeEach(() => jest.clearAllMocks());

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
});
