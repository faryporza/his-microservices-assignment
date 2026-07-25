import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
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
