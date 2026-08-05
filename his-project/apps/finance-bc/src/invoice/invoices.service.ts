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
import { IdempotencyService, rmqClient, StructuredLogger } from '@app/common';
import { CreateInvoiceDTO } from './dto/create-invoice.dto';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import {
  invoicePaidEventName,
  invoicePaidEventVersion,
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
    @Inject(rmqClient)
    private readonly client: ClientProxy,
    private readonly idempotency: IdempotencyService,
  ) {}

  async findAll(): Promise<Invoice[]> {
    return this.invoiceRepository.find({ order: { created_at: 'DESC' } });
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
      where: { visit_id: visitId },
      order: { created_at: 'DESC' },
    });

    if (invoices.length === 0) {
      throw new NotFoundException(`Invoice for visit '${visitId}' not found`);
    }

    return invoices;
  }

  async pay(
    id: string,
    correlationId?: string,
    traceId?: string,
  ): Promise<Invoice> {
    const invoice = await this.findById(id);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException(
        `Invoice with ID '${id}' has already been paid`,
      );
    }

    invoice.status = InvoiceStatus.PAID;
    invoice.paid_at = new Date();
    const saved = await this.invoiceRepository.save(invoice);
    const eventCorrelationId =
      correlationId ?? saved.correlation_id ?? randomUUID();

    const event: InvoicePaidEvent = {
      metadata: {
        eventId: randomUUID(),
        eventName: invoicePaidEventName,
        version: invoicePaidEventVersion,
        occurredAt: new Date().toISOString(),
        correlationId: eventCorrelationId,
        traceId: traceId ?? eventCorrelationId,
      },
      payload: {
        visitId: saved.visit_id,
        invoiceId: saved.id,
        status: 'PAID',
      },
    };

    try {
      await firstValueFrom(this.client.emit(invoicePaidEventName, event));
      this.logger.log({
        message: 'Domain event published',
        trace: {
          traceId: event.metadata.traceId,
          correlationId: event.metadata.correlationId,
        },
        context: {
          action: 'PUBLISH_EVENT',
          event_name: event.metadata.eventName,
          event_id: event.metadata.eventId,
          visit_id: saved.visit_id,
          invoice_id: saved.id,
          event_status: 'PUBLISHED',
        },
      });
    } catch (error: unknown) {
      this.logger.error({
        message: 'Failed to publish domain event',
        trace: {
          traceId: event.metadata.traceId,
          correlationId: event.metadata.correlationId,
        },
        context: {
          action: 'PUBLISH_EVENT',
          event_name: event.metadata.eventName,
          event_id: event.metadata.eventId,
          visit_id: saved.visit_id,
          invoice_id: saved.id,
          event_status: 'PUBLISH_FAILED',
        },
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
            visit_id: event.payload.visitId,
            record_id: event.payload.recordId,
            total_amount: event.payload.treatmentCost,
          },
          manager,
          event.metadata.correlationId,
        );
      },
    );
  }

  async createFromTreatment(
    createDto: CreateInvoiceDTO,
    manager?: EntityManager,
    correlationId?: string,
  ): Promise<Invoice> {
    const repository = manager
      ? manager.getRepository(Invoice)
      : this.invoiceRepository;
    const existingInvoice = await repository.findOne({
      where: { visit_id: createDto.visit_id },
    });

    if (existingInvoice) {
      return existingInvoice;
    }

    const totalAmount = this.normalizeAmount(createDto.total_amount);
    const invoiceData: Partial<Invoice> = {
      visit_id: createDto.visit_id,
      record_id: createDto.record_id,
      total_amount: totalAmount,
      status: InvoiceStatus.PENDING,
    };
    if (correlationId) {
      invoiceData.correlation_id = correlationId;
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
