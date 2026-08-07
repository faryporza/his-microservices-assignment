import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  IdempotencyService,
  OutboxEventsService,
  StructuredLogger,
} from '@app/common';
import { CreateInvoiceDTO } from '../dto/create-invoice.dto';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
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
    private readonly outboxEvents: OutboxEventsService,
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
    const { saved, event } = await this.outboxEvents.runInTransaction(
      async (manager) => {
        const repository = manager.getRepository(Invoice);
        const invoice = await repository.findOne({ where: { id } });
        if (!invoice) {
          throw new NotFoundException(`Invoice with ID '${id}' not found`);
        }
        if (invoice.status === InvoiceStatus.PAID) {
          throw new ConflictException(
            `Invoice with ID '${id}' has already been paid`,
          );
        }

        invoice.status = InvoiceStatus.PAID;
        invoice.paid_at = new Date();
        const saved = await repository.save(invoice);
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

        await this.outboxEvents.enqueue(manager, invoicePaidEventName, event);
        return { saved, event };
      },
    );

    await this.outboxEvents.publishPending();
    this.logger.log({
      message: 'Domain event queued',
      trace: {
        traceId: event.metadata.traceId,
        correlationId: event.metadata.correlationId,
      },
      context: {
        action: 'QUEUE_EVENT',
        event_name: event.metadata.eventName,
        event_id: event.metadata.eventId,
        visit_id: saved.visit_id,
        invoice_id: saved.id,
        event_status: 'QUEUED',
      },
    });

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
