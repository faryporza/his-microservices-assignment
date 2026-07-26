import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Visit, VisitStatus } from './entities/visit.entity';
import type { InvoicePaidEvent } from '@app/contracts';
import { INVOICE_PAID_EVENT_NAME } from '@app/contracts';

/**
 * Consumes `invoice.paid` events from Finance and closes the corresponding
 * visit. Idempotent: a visit that is already `CLOSED` remains closed on
 * duplicate events.
 */
@Controller()
export class VisitsConsumer {
  constructor(
    @InjectRepository(Visit)
    private readonly visitRepository: Repository<Visit>,
  ) {}

  @EventPattern(INVOICE_PAID_EVENT_NAME)
  async handleInvoicePaid(@Payload() event: InvoicePaidEvent): Promise<void> {
    const visit = await this.visitRepository.findOne({
      where: { id: event.payload.visitId },
    });

    if (!visit) {
      // Visit not found — log and ignore (idempotent)
      return;
    }

    if (visit.status === VisitStatus.CLOSED) {
      // Already closed — idempotent, no-op
      return;
    }

    visit.status = VisitStatus.CLOSED;
    await this.visitRepository.save(visit);
  }
}