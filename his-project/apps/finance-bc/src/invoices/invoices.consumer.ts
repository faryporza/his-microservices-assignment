import { BadRequestException, Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { InvoicesService } from './invoices.service';
import {
  hasValidEventMetadata,
  isUuidV4,
  TREATMENT_COMPLETED_EVENT_NAME,
  TREATMENT_COMPLETED_EVENT_VERSION,
  TreatmentCompletedEvent,
} from '@app/contracts';
import type { Channel, ConsumeMessage } from 'amqplib';

/**
 * Consumes `treatment.completed` events from EMR and creates a pending invoice
 * in Finance. The `treatmentCost` is carried as a string to preserve decimal
 * precision; the service normalizes it before persisting.
 */
@Controller()
export class InvoicesConsumer {
  private readonly logger = new Logger(InvoicesConsumer.name);

  constructor(private readonly service: InvoicesService) {}

  @EventPattern(TREATMENT_COMPLETED_EVENT_NAME)
  async handleTreatmentCompleted(
    @Payload() event: unknown,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;

    if (!this.isTreatmentCompletedEvent(event)) {
      this.logger.error('Discarding invalid treatment.completed event');
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.service.processTreatmentCompleted(event);
      channel.ack(message);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        channel.nack(message, false, false);
        return;
      }

      this.logger.error(
        `Failed to process treatment.completed ${event.metadata.eventId}`,
        error instanceof Error ? error.stack : undefined,
      );
      channel.nack(message, false, true);
      throw error;
    }
  }

  private isTreatmentCompletedEvent(
    event: unknown,
  ): event is TreatmentCompletedEvent {
    if (typeof event !== 'object' || event === null) {
      return false;
    }

    const candidate = event as Partial<TreatmentCompletedEvent>;
    const payload = candidate.payload;
    return (
      hasValidEventMetadata(
        candidate.metadata,
        TREATMENT_COMPLETED_EVENT_NAME,
        TREATMENT_COMPLETED_EVENT_VERSION,
      ) &&
      isUuidV4(payload?.visitId) &&
      isUuidV4(payload.recordId) &&
      typeof payload.treatmentCost === 'string' &&
      /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(payload.treatmentCost)
    );
  }
}
