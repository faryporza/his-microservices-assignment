import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InvoicesService } from './invoices.service';
import type { TreatmentCompletedEvent } from '@app/contracts';
import { TREATMENT_COMPLETED_EVENT_NAME } from '@app/contracts';

/**
 * Consumes `treatment.completed` events from EMR and creates a pending invoice
 * in Finance. The `treatmentCost` is carried as a string to preserve decimal
 * precision; the service normalizes it before persisting.
 */
@Controller()
export class InvoicesConsumer {
  constructor(private readonly service: InvoicesService) {}

  @EventPattern(TREATMENT_COMPLETED_EVENT_NAME)
  async handleTreatmentCompleted(
    @Payload() event: TreatmentCompletedEvent,
  ): Promise<void> {
    await this.service.createFromTreatment({
      visitId: event.payload.visitId,
      recordId: event.payload.recordId,
      totalAmount: event.payload.treatmentCost,
    });
  }
}