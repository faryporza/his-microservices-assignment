import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { ProcessedEvent } from '../messaging/entities/processed-event.entity';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(ProcessedEvent)
    private readonly processedEventRepository: Repository<ProcessedEvent>,
  ) {}

  // Intended for the treatment.completed consumer, not a public REST endpoint.
  async createFromTreatment(
    eventId: string,
    createDto: CreateInvoiceDto,
  ): Promise<Invoice | null> {
    const eventWasProcessed = await this.processedEventRepository.exists({
      where: { eventId },
    });
    if (eventWasProcessed) {
      return null;
    }

    const totalAmount = this.normalizeAmount(createDto.totalAmount);
    const existingInvoice = await this.invoiceRepository.findOne({
      where: { visitId: createDto.visitId },
    });
    if (existingInvoice) {
      await this.markEventProcessed(eventId);
      return existingInvoice;
    }

    const invoice = this.invoiceRepository.create({
      visitId: createDto.visitId,
      recordId: createDto.recordId,
      totalAmount,
      status: InvoiceStatus.PENDING,
    });
    const savedInvoice = await this.invoiceRepository.save(invoice);
    await this.markEventProcessed(eventId);
    return savedInvoice;
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
    return this.invoiceRepository.save(invoice);
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

  private async markEventProcessed(eventId: string): Promise<void> {
    const processedEvent = this.processedEventRepository.create({ eventId });
    await this.processedEventRepository.save(processedEvent);
  }
}
