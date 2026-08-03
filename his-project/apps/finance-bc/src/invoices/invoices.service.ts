import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { IdempotencyService, RMQ_CLIENT, StructuredLogger } from '@app/common';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import {
  INVOICE_PAID_EVENT_NAME,
  INVOICE_PAID_EVENT_VERSION,
  InvoicePaidEvent,
  TreatmentCompletedEvent,
} from '@app/contracts';
import { randomUUID } from 'crypto';

@Injectable()
export class InvoicesService {
  private readonly logger = new StructuredLogger('finance-bc');

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @Inject(RMQ_CLIENT)
    private readonly client: ClientProxy,
    private readonly idempotency: IdempotencyService,
  ) {}

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
    const invoices = await this.invoiceRepository.find({
      where: { visitId },
      order: { createdAt: 'DESC' },
    });

    if (invoices.length === 0) {
      throw new NotFoundException(`Invoice for visit '${visitId}' not found`);
    }

    return invoices;
  }

  async pay(id: string, correlationId?: string): Promise<Invoice> {
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
        correlationId: saved.correlationId ?? correlationId ?? randomUUID(),
      },
      payload: {
        visitId: saved.visitId,
        invoiceId: saved.id,
        status: 'PAID',
      },
    };

    try {
      await firstValueFrom(this.client.emit(INVOICE_PAID_EVENT_NAME, event));
      this.logger.log({
        eventName: event.metadata.eventName,
        eventId: event.metadata.eventId,
        correlationId: event.metadata.correlationId,
        visitId: saved.visitId,
        status: 'PUBLISHED',
      });
    } catch (error: unknown) {
      this.logger.error({
        eventName: event.metadata.eventName,
        eventId: event.metadata.eventId,
        correlationId: event.metadata.correlationId,
        visitId: saved.visitId,
        status: 'PUBLISH_FAILED',
        error,
      });
      throw new ServiceUnavailableException('Message broker unavailable');
    }

    return saved;
  }

  async processTreatmentCompleted(
    event: TreatmentCompletedEvent,
  ): Promise<void> {
    await this.idempotency.process(
      event.metadata.eventId,
      event.metadata.eventName,
      async (manager) => {
        await this.createFromTreatment(
          {
            visitId: event.payload.visitId,
            recordId: event.payload.recordId,
            totalAmount: event.payload.treatmentCost,
          },
          manager,
          event.metadata.correlationId,
        );
      },
    );
  }

  async createFromTreatment(
    createDto: CreateInvoiceDto,
    manager?: EntityManager,
    correlationId?: string,
  ): Promise<Invoice> {
    const repository = manager
      ? manager.getRepository(Invoice)
      : this.invoiceRepository;
    const existingInvoice = await repository.findOne({
      where: { visitId: createDto.visitId },
    });

    if (existingInvoice) {
      return existingInvoice;
    }

    const totalAmount = this.normalizeAmount(createDto.totalAmount);
    const invoiceData: Partial<Invoice> = {
      visitId: createDto.visitId,
      recordId: createDto.recordId,
      totalAmount,
      status: InvoiceStatus.PENDING,
    };
    if (correlationId) {
      invoiceData.correlationId = correlationId;
    }

    const invoice = repository.create(invoiceData);
    return repository.save(invoice);
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
