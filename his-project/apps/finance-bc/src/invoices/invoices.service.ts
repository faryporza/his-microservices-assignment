import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import {
  INVOICE_PAID_EVENT_NAME,
  INVOICE_PAID_EVENT_VERSION,
  InvoicePaidEvent,
} from '@app/contracts';
import { randomUUID } from 'crypto';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @Inject('RMQ_CLIENT')
    private readonly client: ClientProxy,
  ) {}

  // Intended for the treatment.completed consumer, not a public REST endpoint.
  async createFromTreatment(createDto: CreateInvoiceDto): Promise<Invoice> {
    const totalAmount = this.normalizeAmount(createDto.totalAmount);

    const invoice = this.invoiceRepository.create({
      visitId: createDto.visitId,
      recordId: createDto.recordId,
      totalAmount,
      status: InvoiceStatus.PENDING,
    });
    return this.invoiceRepository.save(invoice);
  }

  async findAll(): Promise<Invoice[]> {
    return this.invoiceRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID '${id}' not found`);
    }
    return invoice;
  }

  async findByVisitId(visitId: string): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      where: { visitId },
      order: { createdAt: 'DESC' },
    });
  }

  async pay(id: string): Promise<Invoice> {
    const invoice = await this.findById(id);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException(
        `Invoice with ID '${id}' has already been paid`,
      );
    }

    invoice.status = InvoiceStatus.PAID;
    invoice.paidAt = new Date();
    const saved = await this.invoiceRepository.save(invoice);

    const event: InvoicePaidEvent = {
      metadata: {
        eventId: randomUUID(),
        eventName: INVOICE_PAID_EVENT_NAME,
        version: INVOICE_PAID_EVENT_VERSION,
        occurredAt: new Date().toISOString(),
      },
      payload: {
        visitId: saved.visitId,
        invoiceId: saved.id,
        status: 'PAID',
      },
    };

    this.client.emit(INVOICE_PAID_EVENT_NAME, event);

    return saved;
  }

  private normalizeAmount(amount: string | number): string {
    const value = String(amount);
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
      throw new BadRequestException(
        'Total amount must be a non-negative decimal with at most two decimal places',
      );
    }

    const [whole, fraction = ''] = value.split('.');
    return `${whole}.${fraction.padEnd(2, '0')}`;
  }
}
