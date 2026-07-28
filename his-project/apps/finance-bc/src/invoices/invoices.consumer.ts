import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import {
  TREATMENT_COMPLETED_EVENT_NAME,
  TREATMENT_COMPLETED_EVENT_VERSION,
  TreatmentCompletedEvent,
} from '@app/contracts';
import type { Channel, ConsumeMessage } from 'amqplib';
import { InvoicesService } from './invoices.service';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller()
export class InvoicesConsumer {
  private readonly logger = new Logger(InvoicesConsumer.name);

  constructor(private readonly invoicesService: InvoicesService) {}

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
      await this.invoicesService.createFromTreatment(event.metadata.eventId, {
        visitId: event.payload.visitId,
        recordId: event.payload.recordId,
        totalAmount: event.payload.treatmentCost,
      });
      channel.ack(message);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create invoice for visit ${event.payload.visitId}`,
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
    const metadata = candidate.metadata;
    const payload = candidate.payload;

    return (
      metadata?.eventName === TREATMENT_COMPLETED_EVENT_NAME &&
      metadata.version === TREATMENT_COMPLETED_EVENT_VERSION &&
      typeof metadata.eventId === 'string' &&
      UUID_V4_PATTERN.test(metadata.eventId) &&
      typeof metadata.occurredAt === 'string' &&
      !Number.isNaN(Date.parse(metadata.occurredAt)) &&
      typeof payload?.visitId === 'string' &&
      UUID_V4_PATTERN.test(payload.visitId) &&
      typeof payload.recordId === 'string' &&
      UUID_V4_PATTERN.test(payload.recordId) &&
      typeof payload.treatmentCost === 'number' &&
      Number.isFinite(payload.treatmentCost) &&
      payload.treatmentCost >= 0
    );
  }
}
